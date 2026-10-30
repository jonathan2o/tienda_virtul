import logging
import re
from typing import Tuple

import httpx
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from google import genai
from google.genai import types

from stock.models import Stock
from .models import ConfigBot, Conversacion

logger = logging.getLogger(__name__)

_HTTP_CLIENT: httpx.Client | None = None

ORDEN_TALLAS = {'S': 1, 'M': 2, 'L': 3, 'XL': 4, 'XXL': 5, '2XL': 5, 'XXXL': 6, '3XL': 6}


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
    y normaliza espacios para poder agrupar 'una de cada una' por diseño.
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


def obtener_qs_oversize(incluir_imagen: bool = False):
    """
    Devuelve el queryset de Stock filtrado únicamente al catálogo de Oversizes
    (si existen productos oversize en la BD; si no, devuelve el stock general para tests).
    """
    qs = Stock.objects.select_related('producto', 'producto__categoria').filter(cantidad__gt=0)
    if not incluir_imagen:
        qs = qs.defer('producto__imagen', 'producto__imagen_guia_tallas')
    else:
        qs = qs.defer('producto__imagen_guia_tallas')

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
    SOLO UNA referencia de cada diseño con todas sus tallas disponibles.
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
                'cantidad_total': 0,
            }
        grupos[clave]['tallas'][talla] = grupos[clave]['tallas'].get(talla, 0) + (s.cantidad or 0)
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


def _saludo_actual() -> str:
    hora = timezone.localtime().hour
    if hora < 12:
        return "buenos días"
    if hora < 19:
        return "buenas tardes"
    return "buenas noches"


def construir_resumen_inventario() -> str:
    """Construye un listado agrupado (1 por diseño) del catálogo de Oversizes."""
    stocks = obtener_qs_oversize(incluir_imagen=False)
    grupos = agrupar_stocks_por_diseno(stocks)
    if not grupos:
        return "Actualmente no hay camisetas Oversize con unidades disponibles."

    lineas = []
    for g in grupos:
        lineas.append(
            f"- Diseño: {g['nombre_base']} | Tallas disponibles: {g['detalle_tallas']} | "
            f"Precio: ${g['precio']:,.0f} COP"
        )
    return "\n".join(lineas)


def construir_instrucciones_sistema(cfg: ConfigBot) -> str:
    inventario_txt = construir_resumen_inventario()
    saludo = _saludo_actual()
    tono = (cfg.tono or "").strip()
    reglas_extra = (cfg.reglas_extra or "").strip()

    instrucciones = f"""Eres el mejor asesor comercial y vendedor estrella de Techno Shop, especialista en nuestra línea exclusiva de **Camisetas Oversize**.
En este momento son las horas de la {saludo} (saluda con entusiasmo diciendo "¡Hola, muy {saludo}!").

ACTITUD Y ESTILO DE VENTA (MUY IMPORTANTE):
- Eres carismático, cercano, persuasivo y muy vendedor. Tu objetivo es enamorar al cliente de nuestras Camisetas Oversize y guiarlo hasta cerrar su compra.
- ÚNICAMENTE manejamos el **Catálogo de Camisetas Oversize** (no menciones ni ofrezcas otras categorías).
- Cuando el cliente salude, escriba "Hola quiero más información", pregunte qué vendemos o pida el catálogo:
  1. Dale una bienvenida cálida y con mucha actitud comercial.
  2. Cuéntale que manejamos **exclusivamente Camisetas Oversize en tendencia**, con diseños únicos, tela fresca de excelente caída y horma oversize brutal, con precios entre **$50,000 y $53,000 COP** en tallas **M, L, XL y XXXL**.
  3. Invítalo a mirar aquí abajo el catálogo (donde verá **1 foto por cada diseño único** con sus tallas disponibles).
  4. Cierra tu mensaje con una pregunta vendedora directa, por ejemplo: *"¿Qué talla sueles usar (M, L, XL o XXXL) para recomendarte los mejores estilos disponibles ahora mismo?"*
  5. Incluye SIEMPRE al final la etiqueta exacta `[MOSTRAR_CATALOGO]` cuando pidan información, saluden o quieran ver el catálogo/productos.

CATÁLOGO REAL DE DISEÑOS OVERSIZE DISPONIBLES (AGRUPADO 1 POR DISEÑO):
{inventario_txt}

REGLAS DE CIERRE DE VENTA:
1. Usa exclusivamente los diseños, tallas y precios del listado de arriba. No inventes diseños ni tallas agotadas.
2. Si el cliente pregunta por una talla específica (ej. "qué tienes en XL"), recomiéndale con entusiasmo 4 o 5 diseños brutales que tengan esa talla disponible y dile su precio.
3. Para comprar, indícale que puede tocar el botón **"Me interesa este"** en la tarjeta del diseño que le gustó o escribirnos el nombre del diseño y la talla que desea.
4. Manejamos **Envío a domicilio** (nombre, dirección, barrio y ciudad) y **Recogida en tienda** (solo nombre).
"""
    if tono:
        instrucciones += f"\nPERSONALIDAD CONFIGURADA:\n{tono}\n"
    if reglas_extra:
        instrucciones += f"\nREGLAS ADICIONALES:\n{reglas_extra}\n"

    return instrucciones


def generar_respuesta_gemini(
    mensaje_usuario: str,
    conversacion: Conversacion | None = None,
    cfg: ConfigBot | None = None,
    forzar_catalogo: bool = False,
) -> Tuple[str | None, bool]:
    """
    Envía el mensaje del cliente y el contexto de la conversación a Google Gemini
    y devuelve (respuesta_texto, mostrar_catalogo).
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or ''
    if not api_key:
        return None, False

    if cfg is None:
        cfg = ConfigBot.obtener()

    modelo_preferido = getattr(settings, 'GEMINI_MODEL', 'gemini-3.1-flash-lite') or 'gemini-3.1-flash-lite'
    modelos_a_probar = [modelo_preferido]
    for fallback_model in ('gemini-3.1-flash-lite', 'gemini-3.8-flash'):
        if fallback_model not in modelos_a_probar:
            modelos_a_probar.append(fallback_model)

    system_instruction = construir_instrucciones_sistema(cfg)

    contents: list[types.Content] = []
    if conversacion is not None:
        ultimos_mensajes = list(conversacion.mensajes.order_by('-fecha')[:10])
        ultimos_mensajes.reverse()
        for m in ultimos_mensajes:
            if m.texto == mensaje_usuario and m == ultimos_mensajes[-1]:
                continue
            role = 'user' if m.autor == 'cliente' else 'model'
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=m.texto)],
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
        temperature=0.55,
        max_output_tokens=700,
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

            mostrar_catalogo = forzar_catalogo
            if '[MOSTRAR_CATALOGO]' in texto:
                mostrar_catalogo = True
                texto = texto.replace('[MOSTRAR_CATALOGO]', '').strip()

            return texto, mostrar_catalogo
        except Exception as exc:
            ultimo_error = exc
            logger.warning("Error consultando Gemini con modelo %s: %s", model_name, exc)

    logger.error("No fue posible obtener respuesta de Gemini: %s", ultimo_error)
    return None, False
