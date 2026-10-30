import base64
import io
from PIL import Image

from django.conf import settings
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from stock.models import Stock
from usuarios.permissions import IsAdminRole

from .models import ConfigBot, Conversacion, Mensaje
from .serializers import (
    ConfigBotSerializer,
    ConversacionSerializer,
    MensajeSerializer,
    SimuladorInputSerializer,
    ResponderInputSerializer,
)
from .engine import BotEngine
from .gemini_service import (
    agrupar_stocks_por_diseno,
    generar_respuesta_gemini,
    obtener_qs_oversize,
)


_THUMB_CACHE: dict[int, str | None] = {}


def _obtener_miniatura_base64(prod_id: int, raw_img: str | None) -> str | None:
    if prod_id in _THUMB_CACHE:
        return _THUMB_CACHE[prod_id]
    if not raw_img:
        _THUMB_CACHE[prod_id] = None
        return None
    try:
        b64_data = raw_img.split(',', 1)[1] if ',' in raw_img else raw_img
        img_bytes = base64.b64decode(b64_data)
        with Image.open(io.BytesIO(img_bytes)) as im:
            im = im.convert('RGB')
            im.thumbnail((240, 240))
            buf = io.BytesIO()
            im.save(buf, format='JPEG', quality=72, optimize=True)
            thumb = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"
            _THUMB_CACHE[prod_id] = thumb
            return thumb
    except Exception:
        return raw_img


# ---------- Catálogo Ligero para el Chatbot (Solo Oversizes, 1 por Diseño) ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalogo_bot(request):
    stocks = obtener_qs_oversize(incluir_imagen=True)
    grupos = agrupar_stocks_por_diseno(stocks)
    items = []
    for g in grupos:
        s = g['stock_representativo']
        p = s.producto
        cat = p.categoria
        nombre_diseno = g['nombre_base']
        tallas_txt = g['tallas_texto'] or 'Única'
        precio = g['precio']
        items.append({
            'id': s.id,
            'producto': nombre_diseno,
            'producto_id': p.id,
            'talla': tallas_txt,
            'precio_recibido': str(s.precio_recibido or p.precio_recibido or 0),
            'precio_comercial': str(precio),
            'porcentaje_margen': str(s.porcentaje_margen or 75),
            'cantidad': g['cantidad_total'],
            'producto_detail': {
                'id': p.id,
                'nombre': nombre_diseno,
                'descripcion': p.descripcion or '',
                'talla': tallas_txt,
                'categoria': {'id': cat.id, 'nombre': cat.nombre, 'descripcion': cat.descripcion} if cat else None,
                'imagen': _obtener_miniatura_base64(p.id, p.imagen),
                'imagen_guia_tallas': None,
                'precio_recibido': str(p.precio_recibido or 0),
                'precio_comercial': str(precio),
                'precio': str(precio),
                'posicion': p.posicion or '',
                'fila': str(p.fila) if p.fila is not None else '',
                'activo': p.activo,
            },
        })
    return Response(items)


# ---------- Config ----------
@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def config_bot(request):
    cfg = ConfigBot.obtener()
    if request.method == 'GET':
        return Response(ConfigBotSerializer(cfg).data)
    partial = (request.method == 'PATCH')
    serializer = ConfigBotSerializer(cfg, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------- Estado ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def estado_bot(request):
    cfg = ConfigBot.obtener()
    return Response({
        'activo': cfg.activo,
        'modo': cfg.modo,
        'conversaciones_total': Conversacion.objects.count(),
        'conversaciones_bot': Conversacion.objects.filter(estado=Conversacion.ESTADO_BOT).count(),
        'conversaciones_humano': Conversacion.objects.filter(estado=Conversacion.ESTADO_HUMANO).count(),
    })


# ---------- Conversaciones ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversaciones_lista(request):
    qs = Conversacion.objects.all()
    serializer = ConversacionSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversacion_mensajes(request, pk):
    try:
        conv = Conversacion.objects.get(pk=pk)
    except Conversacion.DoesNotExist:
        return Response({'detalle': 'Conversación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    msgs = conv.mensajes.all()
    return Response(MensajeSerializer(msgs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def tomar_chat(request, pk):
    try:
        conv = Conversacion.objects.get(pk=pk)
    except Conversacion.DoesNotExist:
        return Response({'detalle': 'Conversación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    conv.estado = Conversacion.ESTADO_HUMANO
    conv.save(update_fields=['estado', 'ultima_actividad'])
    return Response({'detalle': 'Chat tomado por humano.', 'estado': conv.estado})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def responder_manual(request, pk):
    try:
        conv = Conversacion.objects.get(pk=pk)
    except Conversacion.DoesNotExist:
        return Response({'detalle': 'Conversación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = ResponderInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    texto = serializer.validated_data['texto']
    Mensaje.objects.create(conversacion=conv, autor=Mensaje.AUTOR_HUMANO, texto=texto)
    conv.ultima_actividad = timezone.now()
    conv.save(update_fields=['ultima_actividad'])
    return Response({'autor': 'humano', 'texto': texto})


# ---------- Simulador ----------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def simulador(request):
    serializer = SimuladorInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    chat_id = data.get('chat_id', 'simulador')
    nombre = data.get('nombre_cliente', 'Cliente de prueba')
    texto = data['mensaje']

    conv, _ = Conversacion.objects.get_or_create(
        chat_id=chat_id,
        defaults={'nombre_cliente': nombre, 'telefono_cliente': chat_id, 'estado': Conversacion.ESTADO_BOT},
    )
    if conv.nombre_cliente != nombre and nombre:
        conv.nombre_cliente = nombre
        conv.save(update_fields=['nombre_cliente'])

    Mensaje.objects.create(conversacion=conv, autor=Mensaje.AUTOR_CLIENTE, texto=texto)

    cfg = ConfigBot.obtener()
    respuesta = None
    mostrar_catalogo = False
    if conv.estado == Conversacion.ESTADO_HUMANO:
        respuesta = "Este chat está en manos de un humano. El bot no responde."
    else:
        engine = BotEngine(conv)
        respuesta = engine.responder(texto)
        mostrar_catalogo = engine.mostro_catalogo
        if cfg.modo == 'revision':
            respuesta = f"[BORRADOR - modo revisión]\n{respuesta}"

    Mensaje.objects.create(conversacion=conv, autor=Mensaje.AUTOR_BOT, texto=respuesta)
    conv.ultima_actividad = timezone.now()
    conv.save(update_fields=['ultima_actividad'])

    return Response({
        'conversacion_id': conv.id,
        'chat_id': conv.chat_id,
        'respuesta': respuesta,
        'mostrar_catalogo': mostrar_catalogo,
        'modo': cfg.modo,
        'estado_conversacion': conv.estado,
        'gemini_activo': bool(getattr(settings, 'GEMINI_API_KEY', '')),
    })


# ---------- Servicio Directo Gemini ----------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def consultar_gemini(request):
    serializer = SimuladorInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    chat_id = data.get('chat_id', 'simulador')
    nombre = data.get('nombre_cliente', 'Cliente de prueba')
    texto = data['mensaje']

    conv, _ = Conversacion.objects.get_or_create(
        chat_id=chat_id,
        defaults={'nombre_cliente': nombre, 'telefono_cliente': chat_id, 'estado': Conversacion.ESTADO_BOT},
    )
    Mensaje.objects.create(conversacion=conv, autor=Mensaje.AUTOR_CLIENTE, texto=texto)

    cfg = ConfigBot.obtener()
    respuesta_ia, mostrar_catalogo = generar_respuesta_gemini(
        mensaje_usuario=texto,
        conversacion=conv,
        cfg=cfg,
    )
    if not respuesta_ia:
        engine = BotEngine(conv)
        respuesta_ia = engine.responder(texto)
        mostrar_catalogo = engine.mostro_catalogo

    Mensaje.objects.create(conversacion=conv, autor=Mensaje.AUTOR_BOT, texto=respuesta_ia)
    conv.ultima_actividad = timezone.now()
    conv.save(update_fields=['ultima_actividad'])

    return Response({
        'conversacion_id': conv.id,
        'chat_id': conv.chat_id,
        'respuesta': respuesta_ia,
        'mostrar_catalogo': mostrar_catalogo,
        'modo': cfg.modo,
        'estado_conversacion': conv.estado,
        'gemini_activo': True,
    })
