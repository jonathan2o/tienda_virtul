from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.db.models import Q, Sum
from decimal import Decimal

from usuarios.permissions import IsAdminOrReadOnly, IsAdminRole
from .models import Categoria, Producto, Stock, Venta, StockAuditLog
from .services import StockService
from .serializers import (
    CategoriaSerializer,
    ProductoSerializer,
    StockSerializer,
    VentaSerializer,
)


# CATEGORIAS
class CategoriaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    queryset = Categoria.objects.all().order_by('nombre')
    serializer_class = CategoriaSerializer


# PRODUCTOS
@api_view(['GET', 'POST'])
@permission_classes([IsAdminOrReadOnly])
def producto_lista(request):
    if request.method == 'GET':
        productos = Producto.objects.select_related('categoria').all()
        serializer = ProductoSerializer(productos, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = ProductoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAdminOrReadOnly])
def producto_detalle(request, pk):
    try:
        producto = Producto.objects.select_related('categoria').get(pk=pk)
    except Producto.DoesNotExist:
        return Response({'detalle': 'Producto no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = ProductoSerializer(producto)
        return Response(serializer.data)

    elif request.method in ['PUT', 'PATCH']:
        partial = (request.method == 'PATCH')
        serializer = ProductoSerializer(producto, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        producto.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# STOCK
@api_view(['GET', 'POST'])
@permission_classes([IsAdminOrReadOnly])
def stock_lista(request):
    if request.method == 'GET':
        stocks = Stock.objects.select_related(
            'producto'
        ).all()
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = StockSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAdminOrReadOnly])
def stock_detalle(request, pk):
    try:
        stock = Stock.objects.select_related(
            'producto'
        ).get(pk=pk)
    except Stock.DoesNotExist:
        return Response({'detalle': 'Stock no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = StockSerializer(stock)
        return Response(serializer.data)

    elif request.method in ['PUT', 'PATCH']:
        partial = (request.method == 'PATCH')
        serializer = StockSerializer(stock, data=request.data, partial=partial, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        stock.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# VENTAS
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def venta_lista(request):
    if request.method == 'GET':
        ventas = Venta.objects.select_related(
            'stock__producto'
        ).order_by('-fecha_venta')

        estado = request.query_params.get('estado')
        usuario_id = request.query_params.get('usuario')
        if estado:
            ventas = ventas.filter(estado=estado)
        if usuario_id and usuario_id.isdigit():
            if not IsAdminRole().has_permission(request, None) and int(usuario_id) != request.user.id:
                return Response({'detalle': 'Solo puedes consultar tus propias ventas.'}, status=status.HTTP_403_FORBIDDEN)
            ventas = ventas.filter(usuario_id=int(usuario_id))
        elif not IsAdminRole().has_permission(request, None):
            ventas = ventas.filter(usuario=request.user)

        desde = request.query_params.get('desde')
        hasta = request.query_params.get('hasta')
        guia = request.query_params.get('guia')
        cliente = request.query_params.get('cliente')
        if desde:
            ventas = ventas.filter(fecha_venta__date__gte=desde)
        if hasta:
            ventas = ventas.filter(fecha_venta__date__lte=hasta)
        if guia:
            ventas = ventas.filter(numero_guia__icontains=guia)
        if cliente:
            ventas = ventas.filter(
                Q(nombre_cliente__icontains=cliente) | Q(telefono_cliente__icontains=cliente)
            )

        serializer = VentaSerializer(ventas, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = VentaSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
def venta_detalle(request, pk):
    try:
        venta = Venta.objects.select_related(
            'stock__producto'
        ).get(pk=pk)
    except Venta.DoesNotExist:
        return Response({'detalle': 'Venta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        if not IsAdminRole().has_permission(request, None) and venta.usuario_id != request.user.id:
            return Response({'detalle': 'Solo puedes consultar tus propias ventas.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = VentaSerializer(venta)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        es_admin = IsAdminRole().has_permission(request, None)
        if not es_admin and venta.usuario_id != request.user.id:
            return Response({'detalle': 'Solo puedes editar tus propias ventas.'}, status=status.HTTP_403_FORBIDDEN)
        CAMPOS_SEGUIMIENTO = {
            'nombre_cliente', 'telefono_cliente', 'direccion',
            'barrio', 'ciudad', 'numero_guia',
        }
        datos = dict(request.data)
        if not es_admin:
            if 'estado' in datos:
                return Response(
                    {'detalle': 'Solo el administrador puede cambiar el estado.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            datos = {k: v for k, v in datos.items() if k in CAMPOS_SEGUIMIENTO}
        serializer = VentaSerializer(venta, data=datos, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        if not IsAdminRole().has_permission(request, None):
            return Response({'detalle': 'Solo administradores.'}, status=status.HTTP_403_FORBIDDEN)
        venta.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def dashboard_metricas(request):
    """
    Retorna métricas consolidadas de ventas e inventario filtradas por año y mes opcionales.
    Query params: ?mes=8&anio=2026
    """
    mes = request.query_params.get('mes')
    anio = request.query_params.get('anio')

    mes_int = int(mes) if mes and mes.isdigit() else None
    anio_int = int(anio) if anio and anio.isdigit() else None

    metricas = StockService.obtener_metricas_dashboard(mes=mes_int, anio=anio_int)
    return Response(metricas, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def meses_disponibles(request):
    """
    Retorna la lista de períodos (año y mes) con historial de ventas.
    """
    meses = StockService.obtener_meses_disponibles()
    return Response(meses, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminRole])
def reiniciar_mes(request):
    """
    Reinicia / elimina las ventas registradas en un período (mes y año) específico.
    Payload: {"mes": 8, "anio": 2026}
    """
    mes = request.data.get('mes')
    anio = request.data.get('anio')

    if mes is None or anio is None:
        return Response(
            {'error': 'Los campos "mes" (1-12) y "anio" son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        mes_val = int(mes)
        anio_val = int(anio)
    except (ValueError, TypeError):
        return Response(
            {'error': 'Los campos "mes" y "anio" deben ser números enteros válidos.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not (1 <= mes_val <= 12):
        return Response(
            {'error': 'El campo "mes" debe ser un número entre 1 y 12.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    from .services import NOMBRES_MESES
    nombre_mes = f"{NOMBRES_MESES[mes_val - 1]} {anio_val}"
    eliminadas = StockService.reiniciar_ventas_mes(mes=mes_val, anio=anio_val)

    return Response({
        "mensaje": f"Ventas y métricas del período {nombre_mes} reiniciadas con éxito.",
        "ventas_eliminadas": eliminadas,
        "periodo": {
            "mes": mes_val,
            "anio": anio_val,
            "nombre_mes": nombre_mes
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def meses_disponibles(request):
    """
    Retorna la lista de períodos (año y mes) con historial de ventas.
    """
    meses = StockService.obtener_meses_disponibles()
    return Response(meses, status=status.HTTP_200_OK)