from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth.models import User

from stock.models import Categoria, Producto, Venta
from stock.services import StockService

from chatbot.models import ConfigBot, Conversacion
from chatbot.engine import BotEngine


class ChatbotEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='admin', password='x')
        self.cat = Categoria.objects.create(nombre='Ropa')
        self.prod = Producto.objects.create(
            nombre='Camiseta', categoria=self.cat,
            precio_recibido=Decimal('10000'), precio_comercial=Decimal('17500'),
        )
        self.stock, _ = StockService.registrar_o_actualizar_stock(
            producto=self.prod, talla='M', cantidad=5,
            porcentaje_margen=Decimal('75'),
        )
        cfg = ConfigBot.obtener()
        cfg.activo = True
        cfg.modo = 'autonomo'
        cfg.save()
        self.conv = Conversacion.objects.create(chat_id='573001234567', nombre_cliente='Juan', estado=Conversacion.ESTADO_BOT)

    # ---------- helpers de prueba ----------
    def _crear_oversize(self):
        cat = Categoria.objects.create(nombre='Camisas Oversize Hombre')
        p_l = Producto.objects.create(
            nombre='Angel L', categoria=cat,
            precio_recibido=Decimal('25000'), precio_comercial=Decimal('53000'),
        )
        p_xl = Producto.objects.create(
            nombre='Angel XL', categoria=cat,
            precio_recibido=Decimal('25000'), precio_comercial=Decimal('53000'),
        )
        StockService.registrar_o_actualizar_stock(producto=p_l, talla='L', cantidad=3)
        StockService.registrar_o_actualizar_stock(producto=p_xl, talla='XL', cantidad=4)

    def _crear_mujer(self):
        cat = Categoria.objects.create(nombre='Camisas Para Mujer')
        for talla in ('S', 'M'):
            p = Producto.objects.create(
                nombre=f'Luna {talla}', categoria=cat,
                precio_recibido=Decimal('12000'), precio_comercial=Decimal('25000'),
            )
            StockService.registrar_o_actualizar_stock(producto=p, talla=talla, cantidad=6)

    # ---------- compatibilidad ----------
    def test_paso_1_quiero_mas_informacion(self):
        engine = BotEngine(self.conv)
        r = engine.responder('quiero mas informacion')
        self.assertTrue(engine.mostro_catalogo)
        self.assertIn(
            'Mire, por aquí le comparto el catálogo con los estilos disponibles para que lo mire con calma.',
            r,
        )

    def test_saludo_segun_hora(self):
        engine = BotEngine(self.conv)
        self.assertEqual(engine._saludo_por_hora(9), '¡Hola, muy buenos días!')
        self.assertEqual(engine._saludo_por_hora(15), '¡Hola, muy buenas tardes!')
        self.assertEqual(engine._saludo_por_hora(20), '¡Hola, muy buenas noches!')

    # ---------- flujo base (sin parrilla: usa precio de BD) ----------
    def test_flujo_venta_simple(self):
        engine = BotEngine(self.conv)
        r1 = engine.responder('camiseta')
        self.assertIn('Cuántas unidades', r1)
        r2 = engine.responder('2')
        self.assertIn('datos', r2.lower())
        r3 = engine.responder('Juan Perez, Calle 1, Centro, Bogota')
        self.assertIn('Confirmas el pedido', r3)
        r4 = engine.responder('si')
        self.assertIn('Pedido #', r4)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, 3)
        venta = Venta.objects.latest('id')
        self.assertEqual(float(venta.total_venta), 35000.0)

    def test_stock_insuficiente(self):
        engine = BotEngine(self.conv)
        engine.responder('camiseta')
        r = engine.responder('100')
        self.assertIn('Solo quedan', r)

    def test_cancelar(self):
        engine = BotEngine(self.conv)
        engine.responder('camiseta')
        r = engine.responder('cancelar')
        self.assertIn('le comparto el catálogo', r)
        self.assertIsNone(self.conv.contexto.get('phase'))

    # ---------- parrilla oficial oversize ----------
    def test_flujo_oversize_talla_y_parrilla(self):
        self._crear_oversize()
        engine = BotEngine(self.conv)
        r1 = engine.responder('Quiero la Angel')
        self.assertIn('¿Qué talla', r1)
        self.assertIn('L', r1)
        self.assertIn('XL', r1)

        r2 = engine.responder('XL')
        self.assertIn('¿Cuántas te llevas', r2)
        self.assertIn('$73.000', r2)
        self.assertIn('$120.000', r2)

        r3 = engine.responder('2')
        self.assertIn('datos', r3.lower())

        r4 = engine.responder('Juan Perez, Calle 1, Centro, Bogota')
        self.assertIn('$120.000', r4)
        self.assertIn('Confirmas el pedido', r4)

        r5 = engine.responder('si')
        self.assertIn('Pedido #', r5)
        self.assertIn('$120.000', r5)

        venta = Venta.objects.latest('id')
        self.assertEqual(float(venta.total_venta), 120000.0)

    def test_parrilla_oversize_combina_paquetes(self):
        engine = BotEngine(self.conv)
        total, error = engine._parrilla_total({'categoria_actual': 'Camisas Oversize Hombre'}, 3)
        self.assertIsNone(error)
        self.assertEqual(total, 193000)  # paquete de 2 + 1

    # ---------- parrilla oficial mujer ----------
    def test_flujo_mujer_parrilla(self):
        self._crear_mujer()
        engine = BotEngine(self.conv)
        r1 = engine.responder('Quiero la Luna')
        self.assertIn('¿Qué talla', r1)

        r2 = engine.responder('M')
        self.assertIn('¿Cuántas te llevas', r2)
        self.assertIn('$70.000', r2)
        self.assertIn('$92.000', r2)
        self.assertIn('$112.000', r2)

        r3 = engine.responder('3')
        self.assertIn('datos', r3.lower())

        r4 = engine.responder('Maria Lopez, Calle 2, Chapinero, Bogota')
        self.assertIn('$92.000', r4)
        self.assertIn('Confirmas el pedido', r4)

        r5 = engine.responder('si')
        self.assertIn('Pedido #', r5)

        venta = Venta.objects.latest('id')
        self.assertEqual(float(venta.total_venta), 92000.0)

    def test_parrilla_mujer_minimo_dos(self):
        engine = BotEngine(self.conv)
        total, error = engine._parrilla_total({'categoria_actual': 'Camisas Para Mujer'}, 1)
        self.assertIsNone(total)
        self.assertIn('mínimo es 2', error)

    # ---------- interrupciones dentro del flujo ----------
    def test_interrupcion_durante_flujo(self):
        with patch(
            'chatbot.engine.generar_respuesta_gemini',
            return_value=('Sí, veci, enviamos a toda Colombia con pago contra entrega.', False),
        ):
            engine = BotEngine(self.conv)
            engine.responder('camiseta')
            engine.responder('2')
            r = engine.responder('¿Hacen envío a Medellín?')
            self.assertIn('enviamos a toda Colombia', r)
            self.assertIn('nombre, dirección, barrio, ciudad', r)
            self.assertEqual(self.conv.contexto.get('phase'), 'datos')

            r2 = engine.responder('Juan Perez, Calle 1, Centro, Bogota')
            self.assertIn('Confirmas el pedido', r2)

    # ---------- catálogo solo fotos ----------
    def test_catalogo_devuelve_solo_fotos(self):
        engine = BotEngine(self.conv)
        r = engine.responder('Quiero ver el catálogo de camisas oversize')
        self.assertEqual(r, '')
        self.assertTrue(engine.mostro_catalogo)
        self.assertIn('Oversize', engine.catalogo_categoria or '')

    # ---------- configuración ----------
    def test_bot_desactivado(self):
        cfg = ConfigBot.obtener()
        cfg.activo = False
        cfg.save()
        engine = BotEngine(self.conv)
        r = engine.responder('hola')
        self.assertIn('desactivado', r)
        cfg.activo = True
        cfg.save()

    def test_tomar_chat_pausa_bot(self):
        from django.test import Client
        from rest_framework_simplejwt.tokens import RefreshToken
        token = RefreshToken.for_user(self.user)
        from usuarios.models import PerfilUsuario
        perfil = self.user.perfil
        perfil.rol = PerfilUsuario.ROL_ADMIN
        perfil.save()
        c = Client()
        c.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token.access_token}'
        url = f'/api/chatbot/conversaciones/{self.conv.id}/tomar-chat/'
        resp = c.post(url)
        self.assertEqual(resp.status_code, 200)
        self.conv.refresh_from_db()
        self.assertEqual(self.conv.estado, Conversacion.ESTADO_HUMANO)
        resp2 = c.post('/api/chatbot/simulador/', {'chat_id': self.conv.chat_id, 'mensaje': 'hola'}, content_type='application/json')
        self.assertEqual(resp2.status_code, 200)
        self.assertIn('manos de un humano', resp2.json()['respuesta'])
