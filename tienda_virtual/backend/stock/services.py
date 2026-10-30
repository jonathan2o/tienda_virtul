from decimal import Decimal
from typing import Tuple, Dict, Any, List, Optional
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum, F, Count, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from .models import Stock, Producto, Venta, StockAuditLog

NOMBRES_MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


class StockService:
    """
    Servicio de dominio encargado de la gestión lógica del Stock, Tallas, Ventas y Métricas.
    """


    @classmethod
    def registrar_o_actualizar_stock(
        cls, 
        producto: Producto, 
        cantidad: int,
        talla: Optional[str] = None,
        porcentaje_margen: Decimal = Decimal('75.00'),
        categoria_id: Optional[int] = None,
        usuario=None
    ) -> Tuple[Stock, bool]:
        """
        Registra nuevo stock o acumula la cantidad si ya existe.
        Maneja directamente la talla sin dependencia obligatoria de equivalencias.
        Si se envía categoria_id y difiere de la categoría del producto, se actualiza la categoría asociada.
        Retorna una tupla (Stock, creado: bool).
        """
        if categoria_id is not None and producto.categoria_id != categoria_id:
            producto.categoria_id = categoria_id
            producto.save(update_fields=['categoria'])

        talla_nombre = talla or producto.talla or ''

        precio_recibido = producto.precio_recibido
        precio_comercial = producto.precio_comercial or producto.precio

        filtros = {'producto': producto}
        if talla_nombre:
            filtros['talla'] = talla_nombre

        stock = Stock.objects.filter(**filtros).first()
        creado = False
        cantidad_anterior = stock.cantidad if stock is not None else 0

        if stock is None:
            stock = Stock.objects.create(
                producto=producto,
                talla=talla_nombre,
                cantidad=cantidad,
                precio_recibido=precio_recibido,
                precio_comercial=precio_comercial,
                porcentaje_margen=porcentaje_margen
            )
            creado = True
        else:
            stock.cantidad += cantidad
            if talla_nombre:
                stock.talla = talla_nombre
            if porcentaje_margen is not None:
                stock.porcentaje_margen = porcentaje_margen
            if not stock.precio_recibido or stock.precio_recibido == 0:
                stock.precio_recibido = precio_recibido
            stock.save()

        StockAuditLog.objects.create(
            usuario=usuario,
            stock=stock,
            producto=producto,
            accion=StockAuditLog.ACCION_INGRESO if creado else StockAuditLog.ACCION_AJUSTE,
            cantidad_anterior=cantidad_anterior,
            cantidad_nueva=stock.cantidad,
        )

        return stock, creado

    registrar_o_acumular_stock = registrar_o_actualizar_stock

    @classmethod
    @transaction.atomic
    def procesar_venta(
        cls,
        stock_id: int,
        cantidad_a_vender: int,
        usuario=None,
        datos_cliente: Optional[Dict[str, Any]] = None,
        total_venta_override: Optional[Decimal] = None,
    ) -> Venta:
        """
        Procesa una venta con bloqueo select_for_update, descuento atómico y congelamiento de precios históricos.
        `total_venta_override` permite registrar un total negociado (ej. parrilla de paquetes del chatbot)
        sin afectar las ventas normales del POS, que no envían este parámetro.
        """
        if cantidad_a_vender <= 0:
            raise ValidationError("Stock insuficiente para realizar la venta.")

        try:
            stock = Stock.objects.select_for_update().select_related('producto').get(id=stock_id)
        except Stock.DoesNotExist:
            raise ValidationError("Stock no encontrado.")

        if stock.cantidad < cantidad_a_vender:
            raise ValidationError("Stock insuficiente para realizar la venta.")

        # Descontar la cantidad vendida del inventario
        cantidad_anterior = stock.cantidad
        stock.cantidad -= cantidad_a_vender
        stock.save()

        # Capturar precios históricos al momento exacto de la venta
        precio_recibido_historico = (
            stock.precio_recibido or 
            (stock.producto.precio_recibido if stock.producto else Decimal('0.00')) or 
            Decimal('0.00')
        )
        precio_comercial_historico = (
            stock.precio_comercial or 
            (stock.producto.precio_comercial if stock.producto else None) or 
            (stock.producto.precio if stock.producto else None) or 
            Decimal('0.00')
        )
        total_venta = (Decimal(str(cantidad_a_vender)) * Decimal(str(precio_comercial_historico))).quantize(Decimal('0.01'))
        if total_venta_override is not None:
            total_venta = Decimal(str(total_venta_override)).quantize(Decimal('0.01'))
            precio_comercial_historico = (
                total_venta / Decimal(str(cantidad_a_vender))
            ).quantize(Decimal('0.01'))

        # Crear el registro en Venta
        datos_cliente = datos_cliente or {}
        venta = Venta.objects.create(
            stock=stock,
            cantidad_vendida=cantidad_a_vender,
            precio_recibido_historico=precio_recibido_historico,
            precio_comercial_historico=precio_comercial_historico,
            total_venta=total_venta,
            usuario=usuario,
            nombre_cliente=datos_cliente.get('nombre_cliente', ''),
            telefono_cliente=datos_cliente.get('telefono_cliente', ''),
            direccion=datos_cliente.get('direccion', ''),
            barrio=datos_cliente.get('barrio', ''),
            ciudad=datos_cliente.get('ciudad', ''),
            numero_guia=datos_cliente.get('numero_guia', ''),
            estado=datos_cliente.get('estado', Venta.ESTADO_PENDIENTE),
        )

        StockAuditLog.objects.create(
            usuario=usuario,
            stock=stock,
            producto=stock.producto,
            accion=StockAuditLog.ACCION_VENTA,
            cantidad_anterior=cantidad_anterior,
            cantidad_nueva=stock.cantidad,
        )

        return venta

    @classmethod
    def registrar_venta(cls, stock_id: int, cantidad: int) -> Venta:
        return cls.procesar_venta(stock_id=stock_id, cantidad_a_vender=cantidad)

    @classmethod
    def obtener_metricas_dashboard(cls, mes: Optional[int] = None, anio: Optional[int] = None) -> Dict[str, Any]:
        """
        Calcula las métricas dinámicas de ventas según año y mes seleccionados:
        - total_ventas: Suma acumulada de total_venta en el período.
        - total_stock_vendido: Suma acumulada de cantidad_vendida en el período.
        - total_precio_recibido: Suma de (cantidad_vendida * precio_recibido_historico) en el período.
        - total_precio_comercial: Suma de (cantidad_vendida * precio_comercial_historico) en el período.
        - total_unidades_disponibles: Suma de Stock.objects.aggregate(Sum('cantidad')).
        - total_productos: Total de productos registrados en el sistema.
        - productos_disponibles: Cantidad de productos con existencias en stock > 0.
        - productos_no_disponibles: Cantidad de productos con existencias en stock = 0.
        - productos_mas_vendidos: Ranking de productos más vendidos en el período seleccionado.
        - productos_mas_vendidos_historico: Ranking de productos más vendidos histórico general.
        """
        ahora = timezone.now()
        mes_val = int(mes) if mes is not None else ahora.month
        anio_val = int(anio) if anio is not None else ahora.year

        if not (1 <= mes_val <= 12):
            mes_val = ahora.month

        nombre_mes = f"{NOMBRES_MESES[mes_val - 1]} {anio_val}"

        # Filtrar ventas del mes y año específico
        ventas_periodo = Venta.objects.filter(
            fecha_venta__year=anio_val,
            fecha_venta__month=mes_val
        )

        agregado_ventas = ventas_periodo.aggregate(
            total_ventas=Sum('total_venta'),
            total_stock_vendido=Sum('cantidad_vendida'),
            total_precio_recibido=Sum(F('cantidad_vendida') * F('precio_recibido_historico')),
            total_precio_comercial=Sum(F('cantidad_vendida') * F('precio_comercial_historico'))
        )

        agregado_stock = Stock.objects.aggregate(
            total_unidades_disponibles=Sum('cantidad')
        )

        # Métricas de Disponibilidad de Productos en el catálogo
        productos_con_stock = Producto.objects.annotate(
            stock_acumulado=Coalesce(Sum('stocks__cantidad'), 0)
        )
        total_productos = productos_con_stock.count()
        productos_disponibles = productos_con_stock.filter(stock_acumulado__gt=0).count()
        productos_no_disponibles = productos_con_stock.filter(stock_acumulado=0).count()

        # Helper para generar el ranking de productos más vendidos
        def generar_ranking(ventas_qs, limite=10) -> List[Dict[str, Any]]:
            ranking_qs = (
                ventas_qs.filter(stock__producto__isnull=False)
                .values(
                    'stock__producto__id',
                    'stock__producto__nombre',
                    'stock__producto__categoria__nombre',
                    'stock__producto__imagen',
                )
                .annotate(
                    unidades_vendidas=Sum('cantidad_vendida'),
                    total_generado=Sum('total_venta'),
                    costo_total=Sum(F('cantidad_vendida') * F('precio_recibido_historico'))
                )
                .order_by('-unidades_vendidas', '-total_generado')
            )
            if limite is not None:
                ranking_qs = ranking_qs[:limite]

            resultado = []
            for item in ranking_qs:
                img = item.get('stock__producto__imagen')
                img_url = None
                if img:
                    img_str = str(img)
                    if img_str.startswith('http://') or img_str.startswith('https://'):
                        img_url = img_str
                    elif img_str.startswith('/media/'):
                        img_url = img_str
                    elif img_str.startswith('media/'):
                        img_url = f"/{img_str}"
                    else:
                        img_url = f"/media/{img_str}"

                total_gen = float(item['total_generado'] or Decimal('0.00'))
                costo_tot = float(item['costo_total'] or Decimal('0.00'))
                ganancia_gen = max(0.0, total_gen - costo_tot)

                resultado.append({
                    "id": item['stock__producto__id'],
                    "nombre": item['stock__producto__nombre'],
                    "categoria": item.get('stock__producto__categoria__nombre') or "Sin Categoría",
                    "imagen": img_url,
                    "unidades_vendidas": int(item['unidades_vendidas'] or 0),
                    "total_generado": round(total_gen, 2),
                    "costo_total": round(costo_tot, 2),
                    "ganancia_generada": round(ganancia_gen, 2),
                })
            return resultado

        ranking_periodo = generar_ranking(ventas_periodo)
        ranking_historico = generar_ranking(Venta.objects.all(), limite=None)

        agregado_historico = Venta.objects.aggregate(
            total_historico_vendido=Sum('cantidad_vendida'),
            total_historico_ingresos=Sum('total_venta')
        )

        return {
            "periodo": {
                "mes": mes_val,
                "anio": anio_val,
                "nombre_mes": nombre_mes
            },
            "total_ventas": float(agregado_ventas['total_ventas'] or Decimal('0.00')),
            "total_stock_vendido": int(agregado_ventas['total_stock_vendido'] or 0),
            "total_productos_vendidos": int(agregado_ventas['total_stock_vendido'] or 0),
            "total_articulos_distintos_vendidos": len(ranking_periodo),
            "total_precio_recibido": float(agregado_ventas['total_precio_recibido'] or Decimal('0.00')),
            "total_precio_comercial": float(agregado_ventas['total_precio_comercial'] or Decimal('0.00')),
            "total_unidades_disponibles": int(agregado_stock['total_unidades_disponibles'] or 0),
            "total_historico_vendido": int(agregado_historico['total_historico_vendido'] or 0),
            "total_historico_ingresos": float(agregado_historico['total_historico_ingresos'] or Decimal('0.00')),
            "total_productos": total_productos,
            "productos_disponibles": productos_disponibles,
            "productos_no_disponibles": productos_no_disponibles,
            "productos_mas_vendidos": ranking_periodo,
            "productos_mas_vendidos_historico": ranking_historico,
        }

    @classmethod
    def obtener_meses_disponibles(cls) -> List[Dict[str, Any]]:
        """
        Retorna la lista de períodos (mes y año) que contienen ventas históricas,
        incluyendo siempre el mes actual, ordenados cronológicamente descendente.
        """
        ahora = timezone.now()
        periodos_set = set()

        # Incluir mes actual por defecto
        periodos_set.add((ahora.year, ahora.month))

        # Extraer años y meses distintos de ventas
        fechas_ventas = Venta.objects.dates('fecha_venta', 'month', order='DESC')
        for f in fechas_ventas:
            periodos_set.add((f.year, f.month))

        # Ordenar descendente por año y mes
        periodos_ordenados = sorted(list(periodos_set), key=lambda x: (x[0], x[1]), reverse=True)

        resultado = []
        for anio, mes in periodos_ordenados:
            resultado.append({
                "mes": mes,
                "anio": anio,
                "nombre_mes": f"{NOMBRES_MESES[mes - 1]} {anio}"
            })

        return resultado

    @classmethod
    @transaction.atomic
    def reiniciar_ventas_mes(cls, mes: int, anio: int) -> int:
        """
        Reinicia / elimina de forma segura las ventas registradas en un año y mes específicos.
        Retorna el número de registros de venta eliminados.
        """
        ventas_queryset = Venta.objects.filter(
            fecha_venta__year=anio,
            fecha_venta__month=mes
        )
        cantidad_eliminada, _ = ventas_queryset.delete()
        return cantidad_eliminada


# Funciones de conveniencia
procesar_venta = StockService.procesar_venta
registrar_venta = StockService.registrar_venta
obtener_metricas_dashboard = StockService.obtener_metricas_dashboard
obtener_meses_disponibles = StockService.obtener_meses_disponibles
reiniciar_ventas_mes = StockService.reiniciar_ventas_mes



