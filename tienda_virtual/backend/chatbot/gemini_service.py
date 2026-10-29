import logging
from typing import Tuple

import httpx
from django.conf import settings
from django.utils import timezone
from google import genai
from google.genai import types

from stock.models import Stock
from .models import ConfigBot, Conversacion

logger = logging.getLogger(__name__)

_HTTP_CLIENT: httpx.Client | None = None


def _get_http_client() -> httpx.Client:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        _HTTP_CLIENT = httpx.Client(
            transport=httpx.HTTPTransport(local_address='0.0.0.0'),
            timeout=20.0,
        )
    return _HTTP_CLIENT


def _saludo_actual() -> str:
    hora = timezone.localtime().hour
    if hora < 12:
        return "buenos días"
    if hora < 19:
        return "buenas tardes"
    return "buenas noches"


def construir_resumen_inventario() -> str:
    """Construye un listado claro del stock disponible en tiempo real para el prompt de Gemini."""
    stocks = (
        Stock.objects.select_related('producto', 'producto__categoria')
        .filter(cantidad__gt=0)
        .order_by('producto__nombre', 'talla')
    )
    if not stocks.exists():
        return "Actualmente no hay productos con unidades disponibles en inventario."

    lineas = []
    for s in stocks:
        categoria = s.producto.categoria.nombre if s.producto.categoria else "General"
        precio = s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0
        talla = s.talla or s.producto.talla or "Única"
        desc = f" ({s.producto.descripcion})" if getattr(s.producto, 'descripcion', None) else ""
        lineas.append(
            f"- Producto: {s.producto.nombre}{desc} | Categoría: {categoria} | "
            f"Talla: {talla} | Precio: ${precio:,.0f} COP | Disponibles: {s.cantidad} uds"
        )
    return "\n".join(lineas)


def construir_instrucciones_sistema(cfg: ConfigBot) -> str:
    inventario_txt = construir_resumen_inventario()
    saludo = _saludo_actual()
    tono = (cfg.tono or "Cercano, amable, claro y resolutivo en español.").strip()
    reglas_extra = (cfg.reglas_extra or "").strip()

    instrucciones = f"""Eres el asistente virtual inteligente de atención al cliente y ventas de Techno Shop (tienda virtual).
En este momento son las horas de la {_saludo_actual()} (saludo sugerido: "¡Hola, muy {saludo}!").

TONO Y PERSONALIDAD:
{tono}

INVENTARIO REAL DISPONIBLE EN ESTE MOMENTO:
{inventario_txt}

REGLAS DE ATENCIÓN Y VENTAS:
1. Responde siempre en español, de forma natural, cordial, breve y útil.
2. Usa únicamente la información del INVENTARIO REAL DISPONIBLE para informar precios, tallas y existencias. No inventes productos ni precios que no estén en la lista.
3. Si el cliente saluda, pide "más información", pide ver el catálogo, estilos o pregunta qué productos tienes disponibles, incluye al final de tu respuesta la etiqueta exacta [MOSTRAR_CATALOGO] para que la pantalla le despliegue las tarjetas visuales con fotos y botón de compra.
4. Si el cliente quiere comprar un producto, indícale que puede hacer clic en el botón "Me interesa este" de la tarjeta del catálogo o escribir el nombre exacto del producto para pedirle la cantidad y los datos de envío o recogida en tienda.
5. Manejamos dos modalidades de entrega: Envío a domicilio (requiere nombre, dirección, barrio y ciudad) y Recogida en tienda (solo requiere nombre).
"""
    if reglas_extra:
        instrucciones += f"\nREGLAS ADICIONALES DEL NEGOCIO:\n{reglas_extra}\n"

    return instrucciones


def generar_respuesta_gemini(
    mensaje_usuario: str,
    conversacion: Conversacion | None = None,
    cfg: ConfigBot | None = None,
) -> Tuple[str | None, bool]:
    """
    Envía el mensaje del cliente y el contexto de la conversación a Google Gemini
    y devuelve (respuesta_texto, mostrar_catalogo).
    Si no hay API key o ocurre un error de red/API, devuelve (None, False) para permitir fallback.
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
        temperature=0.4,
        max_output_tokens=1024,
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

            return texto, mostrar_catalogo
        except Exception as exc:
            ultimo_error = exc
            logger.warning("Error consultando Gemini con modelo %s: %s", model_name, exc)

    logger.error("No fue posible obtener respuesta de Gemini: %s", ultimo_error)
    return None, False
