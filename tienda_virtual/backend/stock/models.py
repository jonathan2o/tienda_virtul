from decimal import Decimal
from django.db import models


class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True, verbose_name="Nombre de la Categoría")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    nombre = models.CharField(max_length=150)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.SET_NULL,
        related_name='productos',
        null=True,
        blank=True
    )
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción del Producto")
    talla = models.CharField(max_length=50, blank=True, null=True, verbose_name="Talla del Producto")
    imagen = models.TextField(blank=True, null=True)
    imagen_guia_tallas = models.TextField(blank=True, null=True, verbose_name="Imagen Guía de Tallas")
    precio_recibido = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        help_text="Costo de adquisición"
    )
    precio_comercial = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        help_text="Precio final de venta"
    )
    precio = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0.00,
        null=True,
        blank=True
    )
    posicion = models.CharField(max_length=20, blank=True)
    fila = models.PositiveIntegerField(null=True, blank=True)
    activo = models.BooleanField(default=True)

    def calcular_precio_comercial(self, porcentaje_margen=75) -> Decimal:
        """
        Calcula automáticamente el precio comercial dado un margen (por defecto 75%).
        """
        margen = Decimal(str(porcentaje_margen)) / Decimal('100')
        return (self.precio_recibido * (Decimal('1') + margen)).quantize(Decimal('0.01'))

    def save(self, *args, **kwargs):
        if self.precio_recibido and (not self.precio_comercial or self.precio_comercial == 0):
            self.precio_comercial = self.calcular_precio_comercial()
        if not self.precio or self.precio == 0:
            self.precio = self.precio_comercial if self.precio_comercial else self.precio_recibido
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre




class Stock(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='stocks'
    )
    talla = models.CharField(
        max_length=50, 
        blank=True, 
        null=True, 
        verbose_name="Talla"
    )

    precio_recibido = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Costo de adquisición"
    )
    precio_comercial = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Precio de venta al público"
    )
    porcentaje_margen = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=75.00,
        help_text="Porcentaje de ganancia"
    )
    cantidad = models.PositiveIntegerField(
        default=0,
        help_text="Stock Disponible"
    )

    def save(self, *args, **kwargs):
        if self.producto:
            if not self.talla and self.producto.talla:
                self.talla = self.producto.talla
            if not self.precio_recibido or self.precio_recibido == 0:
                self.precio_recibido = self.producto.precio_recibido


        if getattr(self, '_precio_fijado_manualmente', False):
            # Si precio_comercial fue fijado explícitamente, respetarlo
            pass
        elif self.precio_recibido is not None and self.porcentaje_margen is not None:
            # Convertir a Decimal para evitar errores de precisión flotante
            margen = Decimal(str(self.porcentaje_margen))
            costo = Decimal(str(self.precio_recibido))
            # Recalcular precio_comercial usando el porcentaje exacto de la instancia
            self.precio_comercial = (costo * (Decimal('1') + (margen / Decimal('100')))).quantize(Decimal('0.01'))
        elif not self.precio_comercial or self.precio_comercial == 0:
            if self.producto:
                self.precio_comercial = self.producto.precio_comercial or self.producto.precio

        super().save(*args, **kwargs)

    def __str__(self):
        talla_nombre = self.talla or 'Sin talla'
        return f'{self.producto.nombre} - Talla {talla_nombre}'


class Venta(models.Model):
    stock = models.ForeignKey(
        Stock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ventas'
    )
    cantidad_vendida = models.PositiveIntegerField()
    precio_recibido_historico = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Guarda el costo al momento de vender"
    )
    precio_comercial_historico = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Guarda el precio de venta al momento de vender"
    )
    total_venta = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Calculado como cantidad_vendida * precio_comercial_historico"
    )
    fecha_venta = models.DateTimeField(auto_now_add=True)

    usuario = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ventas'
    )
    nombre_cliente = models.CharField(max_length=150, blank=True, default='')
    telefono_cliente = models.CharField(max_length=20, blank=True, default='')
    direccion = models.CharField(max_length=255, blank=True, default='')
    barrio = models.CharField(max_length=100, blank=True, default='')
    ciudad = models.CharField(max_length=100, blank=True, default='')
    numero_guia = models.CharField(max_length=100, blank=True, default='')

    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_COMPLETADA = 'completada'
    ESTADO_DEVOLUCION = 'devolucion'
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_COMPLETADA, 'Completada'),
        (ESTADO_DEVOLUCION, 'Devolución'),
    ]
    estado = models.CharField(
        max_length=15,
        choices=ESTADO_CHOICES,
        default=ESTADO_PENDIENTE
    )

    # Aliases de compatibilidad
    @property
    def cantidad(self):
        return self.cantidad_vendida

    @property
    def precio_recibido_unitario(self):
        return self.precio_recibido_historico

    @property
    def precio_comercial_unitario(self):
        return self.precio_comercial_historico

    @property
    def fecha(self):
        return self.fecha_venta

    def __str__(self):
        prod_nombre = self.stock.producto.nombre if self.stock and self.stock.producto else "Producto no disponible"
        return f"Venta #{self.id} - {prod_nombre} ({self.cantidad_vendida} uds)"


class StockAuditLog(models.Model):
    ACCION_INGRESO = 'ingreso'
    ACCION_AJUSTE = 'ajuste'
    ACCION_VENTA = 'venta'
    ACCION_ELIMINACION = 'eliminacion'
    ACCION_CHOICES = [
        (ACCION_INGRESO, 'Ingreso'),
        (ACCION_AJUSTE, 'Ajuste'),
        (ACCION_VENTA, 'Venta'),
        (ACCION_ELIMINACION, 'Eliminación'),
    ]

    usuario = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    stock = models.ForeignKey(
        Stock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    accion = models.CharField(max_length=15, choices=ACCION_CHOICES, default=ACCION_AJUSTE)
    cantidad_anterior = models.IntegerField(default=0)
    cantidad_nueva = models.IntegerField(default=0)
    diferencia = models.IntegerField(default=0)
    fecha = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.diferencia = self.cantidad_nueva - self.cantidad_anterior
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-fecha']

    def __str__(self):
        prod = self.producto.nombre if self.producto else 'Producto eliminado'
        return f"{self.fecha:%Y-%m-%d %H:%M} - {prod}: {self.cantidad_anterior} -> {self.cantidad_nueva}"



