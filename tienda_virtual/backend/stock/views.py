from django.shortcuts import get_object_or_404

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import (
    Categoria,
    Producto,
    Talla,
    Stock,
    EquivalenciaTalla
)

from .serializers import (
    CategoriaSerializer,
    ProductoSerializer,
    ProductoUbicacionSerializer,
    TallaSerializer,
    StockSerializer,
    EquivalenciaTallaSerializer
)


# =========================================================
# CATEGORÍAS
# =========================================================

@api_view(['GET', 'POST'])
def categoria_lista(request):

    if request.method == 'GET':

        categorias = Categoria.objects.all()

        serializer = CategoriaSerializer(
            categorias,
            many=True
        )

        return Response(serializer.data)

    serializer = CategoriaSerializer(
        data=request.data
    )

    if serializer.is_valid():

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


# =========================================================
# PRODUCTOS
# =========================================================

@api_view(['GET', 'POST'])
def producto_lista(request):

    if request.method == 'GET':

        productos = Producto.objects.select_related(
            'categoria'
        ).prefetch_related(
            'stocks__talla_recibida',
            'stocks__talla_comercial'
        )

        serializer = ProductoSerializer(
            productos,
            many=True
        )

        return Response(serializer.data)

    serializer = ProductoSerializer(
        data=request.data
    )

    if serializer.is_valid():

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['GET', 'PUT', 'DELETE'])
def producto_detalle(request, id):

    producto = get_object_or_404(
        Producto,
        id=id
    )

    if request.method == 'GET':

        serializer = ProductoSerializer(
            producto
        )

        return Response(
            serializer.data
        )

    if request.method == 'PUT':

        serializer = ProductoSerializer(
            producto,
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    producto.delete()

    return Response(
        status=status.HTTP_204_NO_CONTENT
    )


# =========================================================
# TALLAS
# =========================================================

@api_view(['GET', 'POST'])
def talla_lista(request):

    if request.method == 'GET':

        tallas = Talla.objects.all()

        serializer = TallaSerializer(
            tallas,
            many=True
        )

        return Response(
            serializer.data
        )

    serializer = TallaSerializer(
        data=request.data
    )

    if serializer.is_valid():

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


# =========================================================
# STOCK
# =========================================================

@api_view(['GET', 'POST'])
def stock_lista(request):

    if request.method == 'POST':

        producto_id = request.data.get('producto_id')
        talla_recibida_id = request.data.get('talla_recibida_id')
        cantidad = request.data.get('cantidad')

        if not producto_id or not talla_recibida_id or not cantidad:
            return Response(
                {
                    'error': 'producto_id, talla_recibida_id y cantidad son obligatorios.'
                },
                status=400
            )

        try:

            stock_existente = Stock.objects.get(
                producto_id=producto_id,
                talla_recibida_id=talla_recibida_id
            )

            stock_existente.cantidad += int(cantidad)

            stock_existente.save()

            serializer = StockSerializer(
                stock_existente
            )

            return Response(
                serializer.data,
                status=200
            )

        except Stock.DoesNotExist:

            serializer = StockSerializer(
                data=request.data
            )

            if serializer.is_valid():

                serializer.save()

                return Response(
                    serializer.data,
                    status=201
                )

            return Response(
                serializer.errors,
                status=400
            )

    stocks = Stock.objects.select_related(
        'producto',
        'talla_recibida',
        'talla_comercial'
    )

    serializer = StockSerializer(
        stocks,
        many=True
    )

    return Response(
        serializer.data
    )


@api_view(['GET', 'PUT', 'DELETE'])
def stock_detalle(request, id):

    stock = get_object_or_404(
        Stock,
        id=id
    )

    if request.method == 'GET':

        serializer = StockSerializer(
            stock
        )

        return Response(
            serializer.data
        )

    if request.method == 'PUT':

        serializer = StockSerializer(
            stock,
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    stock.delete()

    return Response(
        status=status.HTTP_204_NO_CONTENT
    )


# =========================================================
# PRODUCTOS POR UBICACIÓN
# =========================================================

@api_view(['GET'])
def productos_por_ubicacion(
    request,
    posicion,
    fila
):

    productos = Producto.objects.filter(
        posicion=posicion.upper(),
        fila=fila
    ).prefetch_related(
        'stocks__talla_recibida',
        'stocks__talla_comercial'
    )

    serializer = ProductoUbicacionSerializer(
        productos,
        many=True
    )

    return Response({
        'ubicacion': f'{posicion.upper()}-{fila}',
        'productos': serializer.data
    })


# =========================================================
# EQUIVALENCIAS DE TALLAS
# =========================================================

@api_view(['GET', 'POST'])
def equivalencia_lista(request):

    if request.method == 'GET':

        equivalencias = EquivalenciaTalla.objects.select_related(
            'categoria',
            'talla_recibida',
            'talla_comercial'
        )

        serializer = EquivalenciaTallaSerializer(
            equivalencias,
            many=True
        )

        return Response(
            serializer.data
        )

    serializer = EquivalenciaTallaSerializer(
        data=request.data
    )

    if serializer.is_valid():

        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['GET', 'PUT', 'DELETE'])
def equivalencia_detalle(request, id):

    equivalencia = get_object_or_404(
        EquivalenciaTalla,
        id=id
    )

    if request.method == 'GET':

        serializer = EquivalenciaTallaSerializer(
            equivalencia
        )

        return Response(
            serializer.data
        )

    if request.method == 'PUT':

        serializer = EquivalenciaTallaSerializer(
            equivalencia,
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    equivalencia.delete()

    return Response(
        status=status.HTTP_204_NO_CONTENT
    )