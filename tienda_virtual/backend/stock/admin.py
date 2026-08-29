from django.contrib import admin

from .models import Producto, Talla, Stock


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'nombre',
        'precio',
        'posicion',
        'fila',
        'activo',
    )

    list_filter = (
        'activo',
        'posicion',
        'fila',
    )

    search_fields = (
        'nombre',
    )


@admin.register(Talla)
class TallaAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'nombre',
    )

    search_fields = (
        'nombre',
    )


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):

    list_display = [
        'id',
        'producto',
        'talla_recibida',
        'talla_comercial',
        'cantidad',
    ]

    list_filter = [
        'talla_recibida',
        'talla_comercial',
    ]