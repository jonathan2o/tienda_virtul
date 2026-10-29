from django.contrib import admin
from .models import Categoria, Producto, Stock, Venta, StockAuditLog


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'descripcion')
    search_fields = ('nombre',)


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'nombre',
        'categoria',
        'precio_recibido',
        'precio_comercial',
        'precio',
        'posicion',
        'fila',
        'activo'
    )
    list_filter = ('activo', 'categoria', 'posicion', 'fila')
    search_fields = ('nombre',)


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'producto',
        'talla',
        'precio_recibido',
        'precio_comercial',
        'porcentaje_margen',
        'cantidad'
    )
    list_filter = ('talla',)
    search_fields = ('producto__nombre',)
    list_select_related = ('producto',)


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'stock',
        'cantidad_vendida',
        'precio_recibido_historico',
        'precio_comercial_historico',
        'total_venta',
        'fecha_venta'
    )
    list_filter = ('fecha_venta', 'stock__producto')
    search_fields = ('stock__producto__nombre',)
    date_hierarchy = 'fecha_venta'
    list_select_related = ('stock__producto',)


@admin.register(StockAuditLog)
class StockAuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'producto', 'accion', 'cantidad_anterior', 'cantidad_nueva', 'diferencia', 'fecha')
    list_filter = ('accion', 'fecha')
    date_hierarchy = 'fecha'