from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User

from stock.models import Categoria, Producto
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

    def test_flujo_venta_envio(self):
        engine = BotEngine(self.conv)
        r1 = engine.responder('camiseta')
        self.assertIn('Cuántas unidades', r1)
        r2 = engine.responder('2')
        self.assertIn('envio', r2.lower())
        r3 = engine.responder('envio')
        self.assertIn('nombre, dirección, barrio, ciudad', r3)
        r4 = engine.responder('Juan Perez, Calle 1, Centro, Bogota')
        self.assertIn('Confirmas la compra', r4)
        r5 = engine.responder('si')
        self.assertIn('Venta registrada', r5)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, 3)

    def test_flujo_venta_recogida(self):
        engine = BotEngine(self.conv)
        engine.responder('camiseta')
        engine.responder('1')
        r = engine.responder('recogida')
        self.assertIn('nombre', r.lower())
        r2 = engine.responder('Maria')
        self.assertIn('Confirmas la compra', r2)
        r3 = engine.responder('si')
        self.assertIn('Venta registrada', r3)

    def test_stock_insuficiente(self):
        engine = BotEngine(self.conv)
        engine.responder('camiseta')
        r = engine.responder('100')
        self.assertIn('Solo hay', r)

    def test_cancelar(self):
        engine = BotEngine(self.conv)
        engine.responder('camiseta')
        r = engine.responder('cancelar')
        self.assertIn('le comparto el catálogo', r)
        self.assertIsNone(self.conv.contexto.get('phase'))

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
