from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CategoriaViewSet,
    producto_lista,
    producto_detalle,
    stock_lista,
    stock_detalle,
    venta_lista,
    venta_detalle,
    dashboard_metricas,
    meses_disponibles,
    reiniciar_mes,
)

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet, basename='categoria')

urlpatterns = [
    path('', include(router.urls)),
    
    # Productos
    path(
        'productos/',
        producto_lista,
        name='producto-lista'
    ),
    path(
        'productos/<int:pk>/',
        producto_detalle,
        name='producto-detalle'
    ),


    # Stock
    path(
        'stock/',
        stock_lista,
        name='stock-lista'
    ),
    path(
        'stock/<int:pk>/',
        stock_detalle,
        name='stock-detalle'
    ),
    path(
        'stock/dashboard-metrics/',
        dashboard_metricas,
        name='dashboard-metricas'
    ),
    path(
        'stock/meses-disponibles/',
        meses_disponibles,
        name='meses-disponibles'
    ),
    path(
        'stock/reiniciar-mes/',
        reiniciar_mes,
        name='reiniciar-mes'
    ),
    


    # Ventas
    path(
        'ventas/',
        venta_lista,
        name='venta-lista'
    ),
    path(
        'ventas/<int:pk>/',
        venta_detalle,
        name='venta-detalle'
    ),

    # Panel general, alertas, historial y exportación
]