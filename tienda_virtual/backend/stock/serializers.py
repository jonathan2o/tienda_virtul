from decimal import Decimal
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Categoria, Producto, Stock, Venta
from .services import StockService


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'descripcion']


import base64
import mimetypes


class Base64ImageField(serializers.Field):
    """Acepta un archivo multipart o una cadena base64/data URI y lo guarda como data URI."""

    def to_internal_value(self, data):
        if data is None or data == '':
            return None
        if isinstance(data, str):
            value = data.strip()
            if value.startswith('data:'):
                return value
            return value or None
        if hasattr(data, 'read'):
            mime = getattr(data, 'content_type', None) or mimetypes.guess_type(getattr(data, 'name', '') or '')[0] or 'image/jpeg'
            encoded = base64.b64encode(data.read()).decode('utf-8')
            return f"data:{mime};base64,{encoded}"
        raise serializers.ValidationError('Formato de imagen no válido.')

    def to_representation(self, value):
        if not value:
            return None
        return str(value)


class ProductoSerializer(serializers.ModelSerializer):
    categoria = CategoriaSerializer(read_only=True)
    imagen = Base64ImageField(required=False, allow_null=True)
    imagen_guia_tallas = Base64ImageField(required=False, allow_null=True)
    categoria_id = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
        source='categoria',
        write_only=True,
        required=False,
        allow_null=True
    )
    posicion = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fila = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Producto
        fields = [
            'id',
            'nombre',
            'descripcion',
            'talla',
            'categoria',
            'categoria_id',
            'imagen',
            'imagen_guia_tallas',
            'precio_recibido',
            'precio_comercial',
            'precio',
            'posicion',
            'fila',
            'activo',
        ]

    def _extract_and_prepare_ubicacion(self, validated_data, existing_instance=None):
        import re, json
        posicion = validated_data.get('posicion')
        if posicion is None and existing_instance:
            posicion = existing_instance.posicion
        pos_str = str(posicion).strip() if posicion is not None else ''

        fila = validated_data.get('fila')
        if fila is None and existing_instance:
            fila = existing_instance.fila
        fila_str = str(fila).strip() if fila is not None else ''

        descripcion = validated_data.get('descripcion')
        if descripcion is None and existing_instance:
            descripcion = existing_instance.descripcion
        descripcion = descripcion or ''

        # Limpiar cualquier tag previo de META_UBICACION
        clean_desc = re.sub(r'\s*<!--META_UBICACION:.*?-->', '', descripcion, flags=re.DOTALL).strip()

        # Determinar si hay múltiples ubicaciones o formato texto
        is_multiple = (
            len(pos_str) > 20 or
            ',' in pos_str or
            '-' in pos_str or
            ',' in fila_str or
            '-' in fila_str or
            (fila_str and not fila_str.isdigit())
        ) and bool(pos_str or fila_str)

        if is_multiple:
            meta_payload = json.dumps({'posicion': pos_str, 'fila': fila_str})
            tag = f"\n<!--META_UBICACION:{meta_payload}-->"
            final_desc = (clean_desc + tag).strip()
        else:
            final_desc = clean_desc

        validated_data['descripcion'] = final_desc
        validated_data['posicion'] = pos_str[:20]

        # Extraer el primer entero para no romper la columna integer de la base de datos
        db_fila = None
        if fila_str:
            m = re.search(r'\d+', fila_str)
            if m:
                db_fila = int(m.group(0))
        validated_data['fila'] = db_fila

        return validated_data

    def create(self, validated_data):
        self._extract_and_prepare_ubicacion(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._extract_and_prepare_ubicacion(validated_data, existing_instance=instance)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        import re, json
        desc = instance.descripcion or ''
        m = re.search(r'<!--META_UBICACION:(.*?)-->', desc, flags=re.DOTALL)
        if m:
            try:
                meta = json.loads(m.group(1))
                if 'posicion' in meta and meta['posicion']:
                    data['posicion'] = meta['posicion']
                if 'fila' in meta and meta['fila']:
                    data['fila'] = meta['fila']
                clean_desc = re.sub(r'\s*<!--META_UBICACION:.*?-->', '', desc, flags=re.DOTALL).strip()
                data['descripcion'] = clean_desc
            except Exception:
                pass
        else:
            if instance.fila is not None:
                data['fila'] = str(instance.fila)
        return data





class StockSerializer(serializers.ModelSerializer):
    producto = serializers.CharField(source='producto.nombre', read_only=True)
    producto_id = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all(),
        source='producto',
        write_only=True
    )
    producto_detail = ProductoSerializer(source='producto', read_only=True)
    talla = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    categoria_id = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
        required=False,
        allow_null=True,
        write_only=True
    )

    class Meta:
        model = Stock
        fields = [
            'id',
            'producto',
            'producto_id',
            'producto_detail',
            'categoria_id',
            'talla',
            'precio_recibido',
            'precio_comercial',
            'porcentaje_margen',
            'cantidad',
        ]
        validators = []

    def validate_cantidad(self, value):
        if value < 0:
            raise serializers.ValidationError('La cantidad no puede ser negativa.')
        return value

    def validate(self, attrs):
        return attrs

    def create(self, validated_data):
        producto = validated_data['producto']
        cantidad = validated_data['cantidad']
        talla = validated_data.get('talla')
        porcentaje_margen = validated_data.get('porcentaje_margen')
        categoria = validated_data.get('categoria_id')
        request = self.context.get('request')
        usuario = request.user if request and request.user.is_authenticated else None

        kwargs = {
            'producto': producto,
            'cantidad': cantidad,
            'usuario': usuario,
        }
        if talla is not None:
            kwargs['talla'] = talla
        if porcentaje_margen is not None:
            kwargs['porcentaje_margen'] = porcentaje_margen
        if categoria is not None:
            kwargs['categoria_id'] = categoria.id if hasattr(categoria, 'id') else int(categoria)

        stock, _ = StockService.registrar_o_actualizar_stock(**kwargs)
        return stock

    def update(self, instance, validated_data):
        cantidad_anterior = instance.cantidad
        categoria = validated_data.pop('categoria_id', None)
        if categoria is not None and instance.producto:
            instance.producto.categoria_id = categoria.id if hasattr(categoria, 'id') else int(categoria)
            instance.producto.save(update_fields=['categoria'])

        costo = validated_data.get('precio_recibido', instance.precio_recibido)
        costo_dec = Decimal(str(costo)) if costo is not None else Decimal('0.00')

        if 'precio_comercial' in validated_data and 'porcentaje_margen' not in validated_data:
            nuevo_precio = Decimal(str(validated_data['precio_comercial']))
            if costo_dec > 0:
                nuevo_margen = (((nuevo_precio - costo_dec) / costo_dec) * Decimal('100')).quantize(Decimal('0.01'))
                nuevo_margen = max(Decimal('-999.99'), min(Decimal('999.99'), nuevo_margen))
                validated_data['porcentaje_margen'] = nuevo_margen
            instance._precio_fijado_manualmente = True

        elif 'porcentaje_margen' in validated_data and 'precio_comercial' not in validated_data:
            nuevo_margen = Decimal(str(validated_data['porcentaje_margen']))
            nuevo_precio = (costo_dec * (Decimal('1') + (nuevo_margen / Decimal('100')))).quantize(Decimal('0.01'))
            validated_data['precio_comercial'] = nuevo_precio
            instance._precio_fijado_manualmente = True

        elif 'precio_recibido' in validated_data and 'precio_comercial' not in validated_data and 'porcentaje_margen' not in validated_data:
            # Recalcular automáticamente precio comercial preservando el margen actual
            margen = Decimal(str(instance.porcentaje_margen if instance.porcentaje_margen is not None else '75.00'))
            nuevo_precio = (costo_dec * (Decimal('1') + (margen / Decimal('100')))).quantize(Decimal('0.01'))
            validated_data['precio_comercial'] = nuevo_precio
            instance._precio_fijado_manualmente = True

        elif 'precio_comercial' in validated_data and 'porcentaje_margen' in validated_data:
            instance._precio_fijado_manualmente = True

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Sincronización en tiempo real del costo y precio en el catálogo de productos
        if instance.producto:
            campos_producto = []
            if 'precio_recibido' in validated_data:
                instance.producto.precio_recibido = costo_dec
                campos_producto.append('precio_recibido')
            if 'precio_comercial' in validated_data:
                instance.producto.precio_comercial = instance.precio_comercial
                instance.producto.precio = instance.precio_comercial
                campos_producto.extend(['precio_comercial', 'precio'])
            if campos_producto:
                instance.producto.save(update_fields=list(set(campos_producto)))

        if 'cantidad' in validated_data and validated_data['cantidad'] != cantidad_anterior:
            from .models import StockAuditLog
            request = self.context.get('request')
            StockAuditLog.objects.create(
                usuario=request.user if request and request.user.is_authenticated else None,
                stock=instance,
                producto=instance.producto,
                accion=StockAuditLog.ACCION_AJUSTE,
                cantidad_anterior=cantidad_anterior,
                cantidad_nueva=instance.cantidad,
            )

        return instance


class VentaSerializer(serializers.ModelSerializer):
    stock = StockSerializer(read_only=True)
    stock_id = serializers.PrimaryKeyRelatedField(
        queryset=Stock.objects.all(),
        source='stock',
        write_only=True
    )
    cantidad = serializers.IntegerField(
        source='cantidad_vendida',
        required=False
    )
    producto_nombre = serializers.CharField(
        source='stock.producto.nombre',
        read_only=True
    )
    usuario_nombre = serializers.CharField(
        source='usuario.username',
        read_only=True
    )
    talla = serializers.CharField(
        source='stock.talla',
        read_only=True
    )

    class Meta:
        model = Venta
        fields = [
            'id',
            'stock',
            'stock_id',
            'producto_nombre',
            'talla',
            'cantidad_vendida',
            'cantidad',
            'precio_recibido_historico',
            'precio_comercial_historico',
            'total_venta',
            'fecha_venta',
            'usuario',
            'usuario_nombre',
            'nombre_cliente',
            'telefono_cliente',
            'direccion',
            'barrio',
            'ciudad',
            'numero_guia',
            'estado',
        ]
        read_only_fields = [
            'precio_recibido_historico',
            'precio_comercial_historico',
            'total_venta',
            'fecha_venta',
            'usuario',
        ]
        extra_kwargs = {
            'cantidad_vendida': {'required': False}
        }

    def validate(self, attrs):
        if not self.partial:
            cantidad_vendida = attrs.get('cantidad_vendida')
            if not cantidad_vendida:
                raise serializers.ValidationError({'cantidad_vendida': 'Este campo es requerido.'})
        return attrs

    def create(self, validated_data):
        stock = validated_data['stock']
        cantidad_a_vender = validated_data.get('cantidad_vendida')
        request = self.context.get('request')
        usuario = request.user if request and request.user.is_authenticated else None

        datos_cliente = {
            'nombre_cliente': validated_data.get('nombre_cliente', ''),
            'telefono_cliente': validated_data.get('telefono_cliente', ''),
            'direccion': validated_data.get('direccion', ''),
            'barrio': validated_data.get('barrio', ''),
            'ciudad': validated_data.get('ciudad', ''),
            'numero_guia': validated_data.get('numero_guia', ''),
            'estado': validated_data.get('estado', Venta.ESTADO_PENDIENTE),
        }

        try:
            venta = StockService.procesar_venta(
                stock_id=stock.id,
                cantidad_a_vender=cantidad_a_vender,
                usuario=usuario,
                datos_cliente=datos_cliente
            )
            return venta
        except DjangoValidationError as e:
            error_msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise serializers.ValidationError({'detail': error_msg})
