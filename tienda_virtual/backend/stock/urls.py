from django.urls import path

from .views import (
    categoria_lista,
    producto_lista,
    producto_detalle,
    talla_lista,
    stock_lista,
    stock_detalle,
    productos_por_ubicacion,
    equivalencia_lista,
    equivalencia_detalle
)


urlpatterns = [
    
    path(
        'categorias/',
        categoria_lista,
        name='categoria-lista'
    ),

    path(
        'productos/',
        producto_lista,
        name='producto-lista'
    ),

    path(
        'productos/<int:id>/',
        producto_detalle,
        name='producto-detalle'
    ),
    path(
        'tallas/',
        talla_lista,
        name='talla-lista'
    ),
    
    path(
        'stock/ubicacion/<str:posicion>/<int:fila>/',
        productos_por_ubicacion,
        name='stock-ubicacion'
    ),

    path(
        'stock/',
        stock_lista,
        name='stock-lista'
    ),

    path(
        'stock/<int:id>/',
        stock_detalle,
        name='stock-detalle'
    ),
    
    path(
        'equivalencias/',
        equivalencia_lista,
        name='equivalencia-lista'
    ),

    path(
        'equivalencias/<int:id>/',
        equivalencia_detalle,
        name='equivalencia-detalle'
    ),
    
]