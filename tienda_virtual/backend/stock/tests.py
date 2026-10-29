from decimal import Decimal
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from .models import Categoria, Producto, Stock, Venta
from .services import StockService, procesar_venta, obtener_metricas_dashboard, obtener_meses_disponibles, reiniciar_ventas_mes


class StockServiceTestCase(TestCase):
    def setUp(self):
        self.categoria = Categoria.objects.create(nombre="Calzado")
        self.producto = Producto.objects.create(
            nombre="Zapato Oxford",
            descripcion="Zapato formal de cuero genuino",
            talla="40",
            categoria=self.categoria,
            precio_recibido=Decimal('100.00'),
            posicion="A1",
            fila=2
        )


    def test_calculo_margen_automatico_producto(self):
        # 100 * (1 + 0.75) = 175.00
        self.assertEqual(self.producto.precio_comercial, Decimal('175.00'))
        self.assertEqual(self.producto.precio, Decimal('175.00'))
        self.assertEqual(self.producto.descripcion, "Zapato formal de cuero genuino")
        self.assertEqual(self.producto.talla, "40")

    def test_calculo_margen_automatico_stock(self):
        stock = Stock.objects.create(
            producto=self.producto,
            talla="40",
            precio_recibido=Decimal('80.00'),
            porcentaje_margen=Decimal('50.00'),
            cantidad=10
        )
        # 80 * (1 + 0.50) = 120.00
        self.assertEqual(stock.precio_comercial, Decimal('120.00'))
        self.assertEqual(stock.talla, "40")

    def test_persistencia_margen_personalizado_en_acumulacion(self):
        stock, _ = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="40",
            cantidad=10,
            porcentaje_margen=Decimal('50.00')
        )
        # 100 * (1 + 0.50) = 150.00
        self.assertEqual(stock.porcentaje_margen, Decimal('50.00'))
        self.assertEqual(stock.precio_comercial, Decimal('150.00'))

        # Acumular con nuevo margen del 60%
        stock_actualizado, creado = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="40",
            cantidad=5,
            porcentaje_margen=Decimal('60.00')
        )
        self.assertFalse(creado)
        self.assertEqual(stock_actualizado.cantidad, 15)
        self.assertEqual(stock_actualizado.porcentaje_margen, Decimal('60.00'))
        # 100 * (1 + 0.60) = 160.00
        self.assertEqual(stock_actualizado.precio_comercial, Decimal('160.00'))


    def test_registrar_nuevo_stock_con_talla_directa(self):
        stock, creado = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="M",
            cantidad=10
        )
        self.assertTrue(creado)
        self.assertEqual(stock.cantidad, 10)
        self.assertEqual(stock.talla, "M")
        self.assertEqual(stock.precio_recibido, Decimal('100.00'))
        self.assertEqual(stock.precio_comercial, Decimal('175.00'))

    def test_acumular_stock_existente(self):
        StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="L",
            cantidad=10
        )
        stock, creado = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="L",
            cantidad=5
        )
        self.assertFalse(creado)
        self.assertEqual(stock.cantidad, 15)


class VentasAndMetricsTestCase(TestCase):
    def setUp(self):
        self.categoria = Categoria.objects.create(nombre="Ropa")
        self.producto = Producto.objects.create(
            nombre="Chaqueta Cuero",
            categoria=self.categoria,
            precio_recibido=Decimal('200.00'),
            precio_comercial=Decimal('350.00'),
            talla="L"
        )
        self.stock, _ = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="L",
            cantidad=10
        )

    def test_procesar_venta_exitosa_y_descuento_stock(self):
        venta = procesar_venta(stock_id=self.stock.id, cantidad_a_vender=4)
        
        self.assertEqual(venta.cantidad_vendida, 4)
        self.assertEqual(venta.precio_recibido_historico, Decimal('200.00'))
        self.assertEqual(venta.precio_comercial_historico, Decimal('350.00'))
        self.assertEqual(venta.total_venta, Decimal('1400.00'))

        # Validar stock restante
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, 6)

    def test_rechazo_venta_stock_insuficiente(self):
        with self.assertRaises(Exception) as ctx:
            procesar_venta(stock_id=self.stock.id, cantidad_a_vender=15)
        self.assertIn("Stock insuficiente", str(ctx.exception))

    def test_calculo_metricas_dashboard_mensual(self):
        ahora = timezone.now()
        # Registrar una venta de 3 unidades
        procesar_venta(stock_id=self.stock.id, cantidad_a_vender=3)

        metricas = obtener_metricas_dashboard(mes=ahora.month, anio=ahora.year)

        self.assertEqual(metricas["periodo"]["mes"], ahora.month)
        self.assertEqual(metricas["periodo"]["anio"], ahora.year)
        self.assertEqual(metricas["total_ventas"], 1050.00)
        self.assertEqual(metricas["total_stock_vendido"], 3)
        self.assertEqual(metricas["total_precio_recibido"], 600.00)
        self.assertEqual(metricas["total_precio_comercial"], 1050.00)
        self.assertEqual(metricas["total_unidades_disponibles"], 7)

    def test_reiniciar_ventas_mes(self):
        ahora = timezone.now()
        procesar_venta(stock_id=self.stock.id, cantidad_a_vender=2)
        self.assertEqual(Venta.objects.count(), 1)

        eliminadas = reiniciar_ventas_mes(mes=ahora.month, anio=ahora.year)
        self.assertEqual(eliminadas, 1)
        self.assertEqual(Venta.objects.count(), 0)

        # Verificar que las métricas del mes queden en 0
        metricas = obtener_metricas_dashboard(mes=ahora.month, anio=ahora.year)
        self.assertEqual(metricas["total_ventas"], 0.00)
        self.assertEqual(metricas["total_stock_vendido"], 0)


class StockAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        from django.contrib.auth.models import User
        from usuarios.models import PerfilUsuario
        self.admin_user = User.objects.create_superuser(username='testadmin', password='pass123', email='a@b.com')
        self.admin_user.perfil.rol = PerfilUsuario.ROL_ADMIN
        self.admin_user.perfil.save()
        self.client.force_authenticate(user=self.admin_user)
        self.categoria = Categoria.objects.create(nombre="Ropa")
        self.producto = Producto.objects.create(
            nombre="Camiseta Básica",
            descripcion="100% Algodón Premium",
            talla="M",
            categoria=self.categoria,
            precio_recibido=Decimal('20.00'),
            precio_comercial=Decimal('35.00'),
            posicion="B2",
            fila=1
        )

    def test_crear_producto_con_descripcion_talla_e_imagenes(self):
        import io
        from PIL import Image
        
        file_obj1 = io.BytesIO()
        Image.new("RGB", (10, 10), (255, 0, 0)).save(file_obj1, "PNG")
        file_obj1.seek(0)
        img_dummy = SimpleUploadedFile("foto.png", file_obj1.read(), content_type="image/png")

        file_obj2 = io.BytesIO()
        Image.new("RGB", (10, 10), (0, 255, 0)).save(file_obj2, "PNG")
        file_obj2.seek(0)
        img_guia_dummy = SimpleUploadedFile("guia.png", file_obj2.read(), content_type="image/png")
        
        data = {
            "nombre": "Polo Deportivo",
            "descripcion": "Tela transpirable con tecnología dry-fit",
            "talla": "XL",
            "precio_recibido": 25.00,
            "categoria_id": self.categoria.id,
            "imagen": img_dummy,
            "imagen_guia_tallas": img_guia_dummy
        }
        res = self.client.post("/api/productos/", data, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["nombre"], "Polo Deportivo")
        self.assertEqual(res.data["descripcion"], "Tela transpirable con tecnología dry-fit")
        self.assertEqual(res.data["talla"], "XL")
        self.assertTrue(res.data["imagen"] is not None)
        self.assertTrue(res.data["imagen_guia_tallas"] is not None)

    def test_crear_y_editar_producto_multi_ubicacion(self):
        data = {
            "nombre": "Camisa Oversize Multi-Estante",
            "descripcion": "Camisa con almacenamiento distribuido",
            "talla": "XXL",
            "posicion": "A, B",
            "fila": "1, 2",
            "precio_recibido": 50.00
        }
        res = self.client.post("/api/productos/", data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["posicion"], "A, B")
        self.assertEqual(res.data["fila"], "1, 2")
        self.assertEqual(res.data["descripcion"], "Camisa con almacenamiento distribuido")

        prod_id = res.data["id"]
        res_get = self.client.get(f"/api/productos/{prod_id}/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["posicion"], "A, B")
        self.assertEqual(res_get.data["fila"], "1, 2")
        self.assertEqual(res_get.data["descripcion"], "Camisa con almacenamiento distribuido")

        # Probar actualización PATCH
        res_patch = self.client.patch(f"/api/productos/{prod_id}/", {"posicion": "A-B", "fila": "1-2"}, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["posicion"], "A-B")
        self.assertEqual(res_patch.data["fila"], "1-2")

    def test_crear_stock_con_talla_directa(self):
        data = {
            "producto_id": self.producto.id,
            "talla": "M",
            "cantidad": 20,
            "porcentaje_margen": 50.00
        }
        response = self.client.post("/api/stock/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["cantidad"], 20)
        self.assertEqual(response.data["talla"], "M")
        self.assertEqual(float(response.data["porcentaje_margen"]), 50.00)
        # Costo 20.00 * (1 + 0.50) = 30.00
        self.assertEqual(float(response.data["precio_comercial"]), 30.00)
        self.assertEqual(response.data["producto_detail"]["descripcion"], "100% Algodón Premium")

    def test_acumular_stock_via_api_post(self):
        data = {
            "producto_id": self.producto.id,
            "talla": "M",
            "cantidad": 10
        }
        self.client.post("/api/stock/", data, format="json")
        response = self.client.post("/api/stock/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["cantidad"], 20)

    def test_patch_stock_porcentaje_margen_recalcula_precio_comercial(self):
        stock, _ = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="M",
            cantidad=10,
            porcentaje_margen=Decimal('75.00')
        )
        # 20 * (1 + 0.75) = 35.00
        self.assertEqual(stock.precio_comercial, Decimal('35.00'))

        # Actualizar margen a 100%
        patch_data = {"porcentaje_margen": 100.00}
        response = self.client.patch(f"/api/stock/{stock.id}/", patch_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data["porcentaje_margen"]), 100.00)
        # 20 * (1 + 1.00) = 40.00
        self.assertEqual(float(response.data["precio_comercial"]), 40.00)

    def test_api_ventas_y_metricas_dashboard_mensual(self):
        ahora = timezone.now()
        stock, _ = StockService.registrar_o_actualizar_stock(
            producto=self.producto,
            talla="M",
            cantidad=20
        )

        # POST /api/ventas/
        venta_payload = {
            "stock_id": stock.id,
            "cantidad_vendida": 5
        }
        res_venta = self.client.post("/api/ventas/", venta_payload, format="json")
        self.assertEqual(res_venta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_venta.data["cantidad_vendida"], 5)
        self.assertEqual(float(res_venta.data["total_venta"]), 175.00)

        # GET /api/ventas/
        res_list_ventas = self.client.get("/api/ventas/")
        self.assertEqual(res_list_ventas.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list_ventas.data), 1)

        # GET /api/stock/dashboard-metrics/?mes=...&anio=...
        url_metricas = f"/api/stock/dashboard-metrics/?mes={ahora.month}&anio={ahora.year}"
        res_metricas = self.client.get(url_metricas)
        self.assertEqual(res_metricas.status_code, status.HTTP_200_OK)
        self.assertEqual(res_metricas.data["periodo"]["mes"], ahora.month)
        self.assertEqual(res_metricas.data["periodo"]["anio"], ahora.year)
        self.assertEqual(res_metricas.data["total_ventas"], 175.00)
        self.assertEqual(res_metricas.data["total_stock_vendido"], 5)
        self.assertEqual(res_metricas.data["total_precio_recibido"], 100.00) # 5 * 20
        self.assertEqual(res_metricas.data["total_precio_comercial"], 175.00) # 5 * 35
        self.assertEqual(res_metricas.data["total_unidades_disponibles"], 15)

        # GET /api/stock/meses-disponibles/
        res_meses = self.client.get("/api/stock/meses-disponibles/")
        self.assertEqual(res_meses.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_meses.data) >= 1)
        self.assertEqual(res_meses.data[0]["mes"], ahora.month)

        # POST /api/stock/reiniciar-mes/
        res_reiniciar = self.client.post("/api/stock/reiniciar-mes/", {
            "mes": ahora.month,
            "anio": ahora.year
        }, format="json")
        self.assertEqual(res_reiniciar.status_code, status.HTTP_200_OK)
        self.assertEqual(res_reiniciar.data["ventas_eliminadas"], 1)

        # Comprobar métricas en 0 tras reinicio
        res_metricas_post = self.client.get(url_metricas)
        self.assertEqual(res_metricas_post.data["total_ventas"], 0.00)
        self.assertEqual(res_metricas_post.data["total_stock_vendido"], 0)

    def test_actualizar_categoria_producto_desde_stock(self):
        nueva_cat = Categoria.objects.create(nombre="Deportes")
        data = {
            "producto_id": self.producto.id,
            "categoria_id": nueva_cat.id,
            "talla": "M",
            "cantidad": 5
        }
        res = self.client.post("/api/stock/", data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.categoria, nueva_cat)

    def test_actualizar_precio_comercial_independiente_recalcula_margen(self):
        stock = Stock.objects.create(
            producto=self.producto,
            talla="M",
            cantidad=10,
            precio_recibido=Decimal('20.00'),
            porcentaje_margen=Decimal('75.00')
        )
        # Costo = 20.00, Precio original = 35.00 (+75%)
        # Actualizamos precio_comercial a 40.00 -> Margen debe ser (40-20)/20 * 100 = 100%
        res = self.client.patch(f"/api/stock/{stock.id}/", {
            "precio_comercial": 40.00
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        stock.refresh_from_db()
        self.assertEqual(stock.precio_comercial, Decimal('40.00'))
        self.assertEqual(stock.porcentaje_margen, Decimal('100.00'))

    def test_actualizar_margen_independiente_recalcula_precio(self):
        stock = Stock.objects.create(
            producto=self.producto,
            talla="M",
            cantidad=10,
            precio_recibido=Decimal('20.00'),
            porcentaje_margen=Decimal('75.00')
        )
        # Costo = 20.00. Actualizamos margen a 50% -> Precio = 20 * 1.50 = 30.00
        res = self.client.patch(f"/api/stock/{stock.id}/", {
            "porcentaje_margen": 50.00
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        stock.refresh_from_db()
        self.assertEqual(stock.porcentaje_margen, Decimal('50.00'))
        self.assertEqual(stock.precio_comercial, Decimal('30.00'))

    def test_actualizar_precio_recibido_independiente_recalcula_precio_y_sincroniza_producto(self):
        stock = Stock.objects.create(
            producto=self.producto,
            talla="M",
            cantidad=10,
            precio_recibido=Decimal('20.00'),
            porcentaje_margen=Decimal('50.00')
        )
        # Costo inicial = 20.00, Margen = 50%, Precio = 30.00
        # Actualizamos precio_recibido (costo) independientemente a 40.00
        # Precio comercial esperado = 40 * (1 + 0.50) = 60.00
        res = self.client.patch(f"/api/stock/{stock.id}/", {
            "precio_recibido": 40.00
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        stock.refresh_from_db()
        self.assertEqual(stock.precio_recibido, Decimal('40.00'))
        self.assertEqual(stock.porcentaje_margen, Decimal('50.00'))
        self.assertEqual(stock.precio_comercial, Decimal('60.00'))

        # Verificar sincronización automática con el Producto maestro
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_recibido, Decimal('40.00'))
        self.assertEqual(self.producto.precio_comercial, Decimal('60.00'))

    def test_metricas_disponibilidad_y_ranking_productos_mas_vendidos(self):
        ahora = timezone.now()
        # Producto 1 tiene stock
        stock1 = Stock.objects.create(
            producto=self.producto,
            talla="M",
            cantidad=10,
            precio_recibido=Decimal('20.00'),
            precio_comercial=Decimal('40.00')
        )
        # Producto 2 sin existencias (agotado)
        prod_agotado = Producto.objects.create(
            nombre="Pantalón Agotado",
            categoria=self.categoria,
            precio_recibido=Decimal('50.00')
        )
        Stock.objects.create(
            producto=prod_agotado,
            talla="32",
            cantidad=0,
            precio_recibido=Decimal('50.00')
        )

        # Realizar venta del producto 1
        procesar_venta(stock_id=stock1.id, cantidad_a_vender=3)

        res = self.client.get(f"/api/stock/dashboard-metrics/?mes={ahora.month}&anio={ahora.year}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        # Disponibilidad
        self.assertGreaterEqual(data["total_productos"], 2)
        self.assertGreaterEqual(data["productos_disponibles"], 1)
        self.assertGreaterEqual(data["productos_no_disponibles"], 1)
        self.assertEqual(data["total_productos"], data["productos_disponibles"] + data["productos_no_disponibles"])

        # Ranking de más vendidos
        self.assertTrue(len(data["productos_mas_vendidos"]) >= 1)
        top1 = data["productos_mas_vendidos"][0]
        self.assertEqual(top1["id"], self.producto.id)
        self.assertEqual(top1["nombre"], self.producto.nombre)
        self.assertEqual(top1["unidades_vendidas"], 3)
        self.assertEqual(top1["total_generado"], 105.00) # 3 * 35 (margen por defecto 75%)
        self.assertEqual(top1["categoria"], "Ropa")



class VentaPermisosTestCase(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        self.client = APIClient()
        self.admin = User.objects.create_superuser(username="perm_admin", password="x", email="a@a.com")
        self.worker1 = User.objects.create_user(username="worker1", password="x")
        self.worker2 = User.objects.create_user(username="worker2", password="x")
        self.cat = Categoria.objects.create(nombre="PermCat")
        self.prod = Producto.objects.create(
            nombre="PermProd", categoria=self.cat, precio_recibido=Decimal("10.00"),
            precio_comercial=Decimal("20.00"),
        )
        self.stock = Stock.objects.create(producto=self.prod, talla="M", cantidad=50)

    def _vender(self, user, **extra):
        self.client.force_authenticate(user=user)
        payload = {"stock_id": self.stock.id, "cantidad_vendida": 1}
        payload.update(extra)
        return self.client.post("/api/ventas/", payload, format="json")

    def test_worker_solo_ve_sus_ventas(self):
        self._vender(self.worker1, nombre_cliente="A")
        self._vender(self.worker2, nombre_cliente="B")
        self.client.force_authenticate(user=self.worker1)
        res = self.client.get("/api/ventas/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(all(v["usuario"] == self.worker1.id for v in res.data))
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/ventas/")
        self.assertEqual(len(res.data), 2)

    def test_worker_no_puede_cambiar_estado(self):
        venta = self._vender(self.worker1).data
        self.client.force_authenticate(user=self.worker1)
        res = self.client.patch(f"/api/ventas/{venta["id"]}/", {"estado": "completada"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_worker_si_puede_editar_guia_propia(self):
        venta = self._vender(self.worker1).data
        self.client.force_authenticate(user=self.worker1)
        res = self.client.patch(
            f"/api/ventas/{venta["id"]}/",
            {"numero_guia": "GUIA-123", "nombre_cliente": "Juan"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["numero_guia"], "GUIA-123")

    def test_worker_no_edita_venta_ajena(self):
        venta = self._vender(self.worker2).data
        self.client.force_authenticate(user=self.worker1)
        res = self.client.patch(f"/api/ventas/{venta["id"]}/", {"numero_guia": "X"}, format="json")
        self.assertEqual(res.status_code, 403)
        res = self.client.get(f"/api/ventas/{venta["id"]}/")
        self.assertEqual(res.status_code, 403)

    def test_admin_edita_estado_y_guia(self):
        venta = self._vender(self.worker1).data
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/ventas/{venta["id"]}/",
            {"estado": "completada", "numero_guia": "GUIA-999"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["estado"], "completada")


