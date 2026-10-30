import logging
import re
from typing import Tuple

import httpx
from django.conf import settings
from django.db.models import Q
from google import genai
from google.genai import types

from stock.models import Categoria, Stock
from .models import ConfigBot, Conversacion, PARRILA_PRECIOS_DEFAULT

logger = logging.getLogger(__name__)

_HTTP_CLIENT: httpx.Client | None = None

ORDEN_TALLAS = {'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, '2XL': 5, 'XXXL': 6, '3XL': 6}

CONDICIONES_VENTA = (
    "Tienda ubicada en Bogotá. Ventas 100% en línea, sin almacén físico. "
    "Envíos a toda Colombia con pago contra entrega. "
    "La guía de envío se comparte cuando el pedido es despachado."
)


def fmt_cop(valor) -> str:
    """Formatea un valor como pesos colombianos: $73.000"""
    try:
        return f"${int(round(float(valor))):,}".replace(',', '.')
    except (TypeError, ValueError):
        return "$0"


def categoria_key(nombre_categoria: str | None) -> str | None:
    """Mapea el nombre real de la categoría a la llave de la parrilla de precios."""
    low = (nombre_categoria or '').lower()
    if 'oversize' in low:
        return 'oversize_hombre'
    if 'mujer' in low or 'femenin' in low or 'dama' in low:
        return 'camisas_mujer'
    return None


def obtener_parrilla(cfg: ConfigBot | None = None) -> dict:
    if cfg is not None and cfg.precios_paquetes:
        return cfg.precios_paquetes
    return PARRILA_PRECIOS_DEFAULT


def formatear_parrilla(categoria_nombre: str | None, cfg: ConfigBot | None = None) -> str | None:
    """Devuelve la parrilla oficial de venta de la categoría, o None si no aplica."""
    key = categoria_key(categoria_nombre)
    if not key:
        return None
    grid = obtener_parrilla(cfg).get(key)
    if not grid:
        return None
    paquetes = grid.get('paquetes') or {}
    partes = []
    for cantidad_str, precio in sorted(paquetes.items(), key=lambda kv: int(kv[0])):
        cantidad = int(cantidad_str)
        unidad = 'camiseta' if cantidad == 1 else 'camisetas'
        partes.append(f"{cantidad} {unidad}: {fmt_cop(precio)}")
    if not partes:
        return None
    texto = ' · '.join(partes)
    if grid.get('envio_incluido', True):
        texto += ' (envío incluido)'
    return texto


def _get_http_client() -> httpx.Client:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        _HTTP_CLIENT = httpx.Client(
            transport=httpx.HTTPTransport(local_address='0.0.0.0'),
            timeout=20.0,
        )
    return _HTTP_CLIENT


def extraer_nombre_base_y_talla(nombre: str, talla_actual: str | None = None) -> Tuple[str, str]:
    """
    Separa la talla final del nombre del producto (ej: 'Angel XL' -> ('Angel', 'XL'))
    y normaliza espacios para poder agrupar 1 referencia por diseño.
    """
    limpio = re.sub(r'\s+', ' ', (nombre or '').strip())
    talla = (talla_actual or '').strip().upper()
    m = re.match(r'^(.*?)\s+(XXXL|XXL|XL|3XL|2XL|S|M|L)$', limpio, flags=re.IGNORECASE)
    if m:
        base = m.group(1).strip()
        if not talla:
            talla = m.group(2).upper()
        return base, (talla or 'Única')
    return limpio, (talla or 'Única')


def _contiene_palabra(frase: str, texto: str) -> bool:
    if not frase:
        return False
    patron = rf'(?<![a-z0-9áéíóúüñ]){re.escape(frase)}(?![a-z0-9áéíóúüñ])'
    return bool(re.search(patron, texto, flags=re.IGNORECASE))


def obtener_qs_oversize(incluir_imagen: bool = False, categoria_filtro: str | None = None):
    """
    Devuelve el queryset de Stock con existencias reales (> 0).
    Si se indica categoria_filtro, filtra estrictamente por esa categoría.
    Si no, prioriza Oversize (comportamiento histórico del chatbot).
    """
    qs = Stock.objects.select_related('producto', 'producto__categoria').filter(cantidad__gt=0)
    if not incluir_imagen:
        qs = qs.defer('producto__imagen', 'producto__imagen_guia_tallas')
    else:
        qs = qs.defer('producto__imagen_guia_tallas')

    if categoria_filtro:
        return qs.filter(
            Q(producto__categoria__nombre__icontains=categoria_filtro)
            | Q(producto__nombre__icontains=categoria_filtro)
        ).order_by('producto__nombre', 'talla')

    qs_oversize = qs.filter(
        Q(producto__categoria__nombre__icontains='oversize')
        | Q(producto__nombre__icontains='oversize')
    )
    if qs_oversize.exists():
        return qs_oversize.order_by('producto__nombre', 'talla')
    return qs.order_by('producto__nombre', 'talla')


def agrupar_stocks_por_diseno(stocks):
    """
    Agrupa los registros de Stock por nombre de diseño base para mostrar
    1 sola referencia por diseño con sus tallas reales disponibles.
    """
    grupos = {}
    for s in stocks:
        nombre_original = s.producto.nombre or ''
        base, talla = extraer_nombre_base_y_talla(nombre_original, s.talla or s.producto.talla)
        clave = re.sub(r'\s+', ' ', base.lower()).strip()

        precio = s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0
        if clave not in grupos:
            grupos[clave] = {
                'nombre_base': base[:1].upper() + base[1:] if base else nombre_original,
                'stock_representativo': s,
                'precio': precio,
                'tallas': {},
                'stocks_por_talla': {},
                'cantidad_total': 0,
            }
        grupos[clave]['tallas'][talla] = grupos[clave]['tallas'].get(talla, 0) + (s.cantidad or 0)
        grupos[clave]['stocks_por_talla'].setdefault(talla, s)
        grupos[clave]['cantidad_total'] += s.cantidad or 0

    resultado = []
    for g in grupos.values():
        tallas_ordenadas = sorted(
            g['tallas'].keys(),
            key=lambda t: (ORDEN_TALLAS.get(t.upper(), 99), t),
        )
        g['tallas_lista'] = tallas_ordenadas
        g['tallas_texto'] = ', '.join(tallas_ordenadas)
        g['detalle_tallas'] = ', '.join(f"{t} ({g['tallas'][t]} uds)" for t in tallas_ordenadas)
        resultado.append(g)

    resultado.sort(key=lambda x: x['nombre_base'].lower())
    return resultado


def detectar_contexto_producto(texto: str, ctx_actual: dict) -> dict:
    """
    Detecta de qué categoría o diseño está hablando el cliente consultando PostgreSQL
    y actualiza el contexto de la conversación para no perder el hilo.
    """
    low = re.sub(r'\s+', ' ', (texto or '').lower()).strip()
    nuevo_ctx = dict(ctx_actual or {})

    # 1. Categorías reales mencionadas explícitamente
    for cat in Categoria.objects.all():
        nombre_low = (cat.nombre or '').lower()
        if nombre_low and nombre_low in low:
            nuevo_ctx['categoria_actual'] = cat.nombre
            break

    if 'mujer' in low or 'femenin' in low or 'dama' in low:
        nuevo_ctx['categoria_actual'] = 'Camisas Para Mujer'
    elif 'oversize' in low or 'hombre' in low:
        nuevo_ctx['categoria_actual'] = 'Camisas Oversize Hombre'

    # 2. Diseño específico dentro de la categoría detectada
    stocks = obtener_qs_oversize(incluir_imagen=False, categoria_filtro=nuevo_ctx.get('categoria_actual'))
    for g in agrupar_stocks_por_diseno(stocks):
        diseno_low = g['nombre_base'].lower()
        if len(diseno_low) >= 3 and _contiene_palabra(diseno_low, low):
            nuevo_ctx['diseno_actual'] = g['nombre_base']
            nuevo_ctx['producto_actual'] = f"Camisa diseño {g['nombre_base']}"
            break

    # Si aún no hay categoría, usar Oversize solo si existe en la base
    if not nuevo_ctx.get('categoria_actual'):
        if Categoria.objects.filter(nombre__icontains='oversize').exists():
            nuevo_ctx['categoria_actual'] = 'Camisas Oversize Hombre'
    if not nuevo_ctx.get('producto_actual') and nuevo_ctx.get('categoria_actual'):
        nuevo_ctx['producto_actual'] = nuevo_ctx['categoria_actual']

    return nuevo_ctx


def consultar_datos_reales_contexto(ctx: dict, cfg: ConfigBot) -> str:
    """
    Consulta en PostgreSQL los precios, tallas y existencias reales del
    producto/categoría del que se está hablando, más la parrilla oficial de venta.
    """
    categoria = ctx.get('categoria_actual')
    diseno = ctx.get('diseno_actual')
    producto_actual = ctx.get('producto_actual') or categoria or 'Camisa Oversize'

    stocks = obtener_qs_oversize(incluir_imagen=False, categoria_filtro=categoria)
    grupos = agrupar_stocks_por_diseno(stocks)

    lineas = [f"PRODUCTO/CATEGORÍA ACTUAL EN CONVERSACIÓN: {producto_actual}" + (f" ({categoria})" if categoria else "")]
    parrilla = formatear_parrilla(categoria, cfg)
    if parrilla:
        lineas.append(f"- PARRILLA OFICIAL DE VENTA: {parrilla}")
    lineas.append(f"- Condiciones de venta: {CONDICIONES_VENTA}")

    promocion = (cfg.reglas_extra or '').strip()
    if promocion:
        lineas.append(f"- Regla/promoción adicional autorizada: {promocion}")

    if not grupos:
        lineas.append("- Sin unidades disponibles en este momento.")
        return '\n'.join(lineas)

    if diseno:
        for g in grupos:
            if g['nombre_base'].lower() == diseno.lower():
                lineas.append(f"- Diseño en conversación: {g['nombre_base']}")
                lineas.append(f"- Tallas reales disponibles: {g['tallas_texto']}")
                lineas.append(f"- Unidades disponibles: {g['cantidad_total']}")
                if not parrilla:
                    lineas.append(f"- Precio real unitario: {fmt_cop(g['precio'])} COP")
                return '\n'.join(lineas)

    todas_tallas = set()
    for g in grupos:
        todas_tallas.update(g['tallas_lista'])
    tallas_str = ', '.join(sorted(todas_tallas, key=lambda t: (ORDEN_TALLAS.get(t.upper(), 99), t)))
    lineas.append(f"- Tallas reales disponibles: {tallas_str}")
    lineas.append(f"- Diseños disponibles con stock: {len(grupos)}")
    if not parrilla:
        precios = sorted({int(round(float(g['precio']))) for g in grupos})
        lineas.append(f"- Precio real unitario: {fmt_cop(precios[0])} COP")
    return '\n'.join(lineas)


def construir_instrucciones_sistema(
    cfg: ConfigBot,
    ctx: dict,
    ya_saludado: bool,
    modo_auxiliar: bool = False,
) -> str:
    datos_reales = consultar_datos_reales_contexto(ctx, cfg)

    if ya_saludado:
        regla_saludo = (
            "- Ya saludaste antes en esta conversación. PROHIBIDO volver a saludar "
            "(nada de 'Hola', 'Buenas tardes', 'Bienvenido' ni similares). Ve directo a la respuesta."
        )
    else:
        regla_saludo = (
            "- Primer mensaje de la conversación: saluda de forma breve y natural "
            "(puedes usar «veci») y pregunta qué producto busca. Una sola pregunta."
        )

    regla_auxiliar = (
        "\nMODO AUXILIAR: el cliente está a mitad de una compra y preguntó algo distinto. "
        "Responde su duda en UNA sola frase corta y NO hagas preguntas; el sistema retomará el paso pendiente."
        if modo_auxiliar else ""
    )

    return f"""Eres el asesor de ventas humano de Techno Shop, tienda de ropa online en Bogotá. Atiendes por chat como en WhatsApp: cercano, natural, breve y servicial. Usa «veci» con moderación, no en cada frase.

ESTADO DEL SALUDO:
{regla_saludo}

DATOS REALES CONSULTADOS EN POSTGRESQL (ÚNICA FUENTE DE VERDAD):
{datos_reales}

REGLAS DE RESPUESTA:
1. Una sola pregunta por mensaje y espera la respuesta. Respuestas de 1 o 2 frases cortas; nunca párrafos largos.
2. Responde solo lo que el cliente acaba de preguntar. No repitas información que ya diste ni vuelvas a saludar.
3. Precio: usa la PARRILLA OFICIAL del producto en conversación (envío incluido). Si pregunta "¿y cuánto cuesta?" sin nombrar producto, se refiere al PRODUCTO ACTUAL EN CONVERSACIÓN.
4. Tallas: usa únicamente las tallas reales disponibles del producto en conversación.
5. Catálogo/fotos: si el cliente pide ver el catálogo o las fotos, responde únicamente con [MOSTRAR_CATALOGO] (el sistema envía las fotos).
6. Condiciones: tienda en Bogotá, 100% online, envíos a toda Colombia, pago contra entrega, guía al despachar.
7. Prohibido inventar precios, descuentos, tallas, disponibilidad o fechas de entrega. No ofrezcas descuentos.
8. Guía la venta paso a paso (producto → talla → cantidad → datos de envío → confirmación) sin presionar al cliente.{regla_auxiliar}"""


def generar_respuesta_gemini(
    mensaje_usuario: str,
    conversacion: Conversacion | None = None,
    cfg: ConfigBot | None = None,
    ctx: dict | None = None,
    ya_saludado: bool = False,
    modo_auxiliar: bool = False,
) -> Tuple[str | None, bool]:
    """
    Envía el mensaje del cliente, el historial y los datos reales de PostgreSQL a Gemini.
    Devuelve (respuesta_texto, mostrar_catalogo).
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or ''
    if not api_key:
        return None, False

    if cfg is None:
        cfg = ConfigBot.obtener()

    if ctx is None:
        ctx = dict(conversacion.contexto or {}) if conversacion else {}

    modelo_preferido = getattr(settings, 'GEMINI_MODEL', 'gemini-3.1-flash-lite') or 'gemini-3.1-flash-lite'
    modelos_a_probar = [modelo_preferido]
    for fallback_model in ('gemini-3.1-flash-lite', 'gemini-3.8-flash'):
        if fallback_model not in modelos_a_probar:
            modelos_a_probar.append(fallback_model)

    system_instruction = construir_instrucciones_sistema(
        cfg, ctx=ctx, ya_saludado=ya_saludado, modo_auxiliar=modo_auxiliar
    )

    contents: list[types.Content] = []
    if conversacion is not None:
        ultimos_mensajes = list(conversacion.mensajes.order_by('-fecha')[:10])
        ultimos_mensajes.reverse()
        for idx, m in enumerate(ultimos_mensajes):
            # Omitir el mensaje del cliente que se acaba de guardar en views.py para no duplicarlo al final
            if idx == len(ultimos_mensajes) - 1 and m.autor == 'cliente' and m.texto == mensaje_usuario:
                continue
            role = 'user' if m.autor == 'cliente' else 'model'
            texto_hist = m.texto.strip() if m.texto and m.texto.strip() else "[Catálogo de fotografías enviado al cliente]"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=texto_hist)],
                )
            )

    contents.append(
        types.Content(
            role='user',
            parts=[types.Part.from_text(text=mensaje_usuario)],
        )
    )

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(httpx_client=_get_http_client()),
    )
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.2,
        max_output_tokens=160,
    )

    ultimo_error = None
    for model_name in modelos_a_probar:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            texto = (response.text or '').strip()
            if not texto:
                continue

            mostrar_catalogo = False
            if '[MOSTRAR_CATALOGO]' in texto:
                mostrar_catalogo = True
                texto = texto.replace('[MOSTRAR_CATALOGO]', '').strip()

            # Seguridad adicional: si ya había saludado y el modelo incluyó un saludo al inicio, limpiarlo
            if ya_saludado:
                texto = re.sub(
                    r'^(¡?hola[!,\\.\s]*|¡?muy\s+buenos\s+d[ií]as[!,\\.\s]*|¡?muy\s+buenas\s+tardes[!,\\.\s]*|¡?muy\s+buenas\s+noches[!,\\.\s]*|¡?buenos\s+d[ií]as[!,\\.\s]*|¡?buenas\s+tardes[!,\\.\s]*|¡?buenas\s+noches[!,\\.\s]*|¡?buenas[!,\\.\s]*)+',
                    '',
                    texto,
                    flags=re.IGNORECASE,
                ).strip()
                if texto:
                    texto = texto[0].upper() + texto[1:]

            return texto, mostrar_catalogo
        except Exception as exc:
            ultimo_error = exc
            logger.warning("Error consultando Gemini con modelo %s: %s", model_name, exc)

    logger.error("No fue posible obtener respuesta de Gemini: %s", ultimo_error)
    return None, False
