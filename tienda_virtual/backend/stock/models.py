from django.db import models


class Categoria(models.Model):

    nombre = models.CharField(
        max_length=100,
        unique=True
    )

    activo = models.BooleanField(
        default=True
    )

    def __str__(self):
        return self.nombre


class Producto(models.Model):

    nombre = models.CharField(
        max_length=150
    )

    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name='productos',
        null=True,
        blank=True
    )

    imagen = models.ImageField(
        upload_to='productos/',
        null=True,
        blank=True
    )

    precio = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    posicion = models.CharField(
        max_length=20,
        blank=True
    )

    fila = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    activo = models.BooleanField(
        default=True
    )

    def __str__(self):
        return self.nombre


class Talla(models.Model):

    nombre = models.CharField(
        max_length=10,
        unique=True
    )

    def __str__(self):
        return self.nombre


class EquivalenciaTalla(models.Model):

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='equivalencias_talla'
    )

    talla_recibida = models.ForeignKey(
        Talla,
        on_delete=models.PROTECT,
        related_name='equivalencias_recibidas'
    )

    talla_comercial = models.ForeignKey(
        Talla,
        on_delete=models.PROTECT,
        related_name='equivalencias_comerciales'
    )

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=[
                    'producto',
                    'talla_recibida'
                ],
                name='producto_talla_recibida_equivalencia_unica'
            )
        ]

    def __str__(self):

        return (
            f'{self.producto.nombre}: '
            f'{self.talla_recibida.nombre} → '
            f'{self.talla_comercial.nombre}'
        )


class Stock(models.Model):

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='stocks'
    )

    talla_recibida = models.ForeignKey(
        Talla,
        on_delete=models.PROTECT,
        related_name='stocks_recibidos'
    )

    talla_comercial = models.ForeignKey(
        Talla,
        on_delete=models.PROTECT,
        related_name='stocks_comerciales',
        null=True,
        blank=True
    )

    cantidad = models.PositiveIntegerField(
        default=0
    )

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=[
                    'producto',
                    'talla_recibida'
                ],
                name='producto_talla_recibida_unica'
            )
        ]

    def __str__(self):

        return (
            f'{self.producto.nombre} - '
            f'{self.talla_recibida.nombre} → '
            f'{self.talla_comercial.nombre}'
        )