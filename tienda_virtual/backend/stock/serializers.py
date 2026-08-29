from rest_framework import serializers

from .models import (
    Categoria,
    Producto,
    Talla,
    Stock,
    EquivalenciaTalla
)


class CategoriaSerializer(serializers.ModelSerializer):

    class Meta:
        model = Categoria

        fields = [
            'id',
            'nombre',
            'activo',
        ]


class TallaSerializer(serializers.ModelSerializer):

    class Meta:
        model = Talla

        fields = [
            'id',
            'nombre',
        ]


class EquivalenciaTallaSerializer(serializers.ModelSerializer):

    producto = serializers.CharField(
        source='producto.nombre',
        read_only=True
    )

    producto_id = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all(),
        source='producto',
        write_only=True
    )

    talla_recibida = TallaSerializer(
        read_only=True
    )

    talla_recibida_id = serializers.PrimaryKeyRelatedField(
        queryset=Talla.objects.all(),
        source='talla_recibida',
        write_only=True
    )

    talla_comercial = TallaSerializer(
        read_only=True
    )

    talla_comercial_id = serializers.PrimaryKeyRelatedField(
        queryset=Talla.objects.all(),
        source='talla_comercial',
        write_only=True
    )

    class Meta:

        model = EquivalenciaTalla

        fields = [
            'id',
            'producto',
            'producto_id',
            'talla_recibida',
            'talla_recibida_id',
            'talla_comercial',
            'talla_comercial_id',
        ]


class StockSerializer(serializers.ModelSerializer):

    producto = serializers.CharField(
        source='producto.nombre',
        read_only=True
    )

    producto_id = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all(),
        source='producto',
        write_only=True
    )

    talla_recibida = TallaSerializer(
        read_only=True
    )

    talla_recibida_id = serializers.PrimaryKeyRelatedField(
        queryset=Talla.objects.all(),
        source='talla_recibida',
        write_only=True
    )

    talla_comercial = TallaSerializer(
        read_only=True
    )

    talla_comercial_id = serializers.PrimaryKeyRelatedField(
        source='talla_comercial',
        read_only=True
    )

    class Meta:

        model = Stock

        fields = [
            'id',
            'producto',
            'producto_id',
            'talla_recibida',
            'talla_recibida_id',
            'talla_comercial',
            'talla_comercial_id',
            'cantidad',
        ]

        validators = []

    def validate_cantidad(self, value):

        if value < 0:
            raise serializers.ValidationError(
                'La cantidad no puede ser negativa.'
            )

        return value

    def validate(self, attrs):

        producto = attrs.get('producto')
        talla_recibida = attrs.get('talla_recibida')

        if not producto or not talla_recibida:
            return attrs

        # Buscar la equivalencia específica de este producto
        equivalencia = EquivalenciaTalla.objects.filter(
            producto=producto,
            talla_recibida=talla_recibida
        ).first()

        if not equivalencia:

            raise serializers.ValidationError({
                'talla_recibida_id':
                    'No existe una equivalencia de talla '
                    'para este producto.'
            })

        # Asignar automáticamente la talla comercial
        attrs['talla_comercial'] = (
            equivalencia.talla_comercial
        )

        return attrs

    def create(self, validated_data):

        producto = validated_data['producto']
        talla_recibida = validated_data['talla_recibida']
        cantidad = validated_data['cantidad']

        stock = Stock.objects.filter(
            producto=producto,
            talla_recibida=talla_recibida
        ).first()

        if stock:

            stock.cantidad += cantidad
            stock.save()

            return stock

        return Stock.objects.create(
            **validated_data
        )


class ProductoSerializer(serializers.ModelSerializer):

    categoria = CategoriaSerializer(
        read_only=True
    )

    categoria_id = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
        source='categoria',
        write_only=True,
        required=False,
        allow_null=True
    )

    imagen = serializers.ImageField(
        required=False,
        allow_null=True,
        use_url=True
    )

    stocks = StockSerializer(
        many=True,
        read_only=True
    )

    stock_total = serializers.SerializerMethodField()

    class Meta:

        model = Producto

        fields = [
            'id',
            'nombre',
            'categoria',
            'categoria_id',
            'imagen',
            'precio',
            'posicion',
            'fila',
            'activo',
            'stocks',
            'stock_total',
        ]

    def validate_nombre(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                'El nombre del producto es obligatorio.'
            )

        return value

    def validate_precio(self, value):

        if value <= 0:
            raise serializers.ValidationError(
                'El precio debe ser mayor que 0.'
            )

        return value

    def validate_posicion(self, value):

        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError(
                'La posición es obligatoria.'
            )

        return value

    def validate_fila(self, value):

        if value <= 0:
            raise serializers.ValidationError(
                'La fila debe ser mayor que 0.'
            )

        return value

    def get_stock_total(self, obj):

        return sum(
            stock.cantidad
            for stock in obj.stocks.all()
        )


class ProductoUbicacionSerializer(serializers.ModelSerializer):

    stock_total = serializers.SerializerMethodField()

    tallas = serializers.SerializerMethodField()

    ubicacion = serializers.SerializerMethodField()

    class Meta:

        model = Producto

        fields = [
            'id',
            'nombre',
            'imagen',
            'precio',
            'posicion',
            'fila',
            'ubicacion',
            'stock_total',
            'tallas',
        ]

    def get_stock_total(self, obj):

        return sum(
            stock.cantidad
            for stock in obj.stocks.all()
            if stock.talla_comercial
        )

    def get_tallas(self, obj):

        tallas = {}

        for stock in obj.stocks.all():

            if not stock.talla_comercial:
                continue

            nombre_talla = stock.talla_comercial.nombre

            if nombre_talla not in tallas:
                tallas[nombre_talla] = 0

            tallas[nombre_talla] += stock.cantidad

        return tallas

    def get_ubicacion(self, obj):

        return f'{obj.posicion}-{obj.fila}'

