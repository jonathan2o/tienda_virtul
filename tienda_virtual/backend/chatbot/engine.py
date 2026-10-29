import re
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone

from stock.models import Stock
from stock.services import StockService

from .models import ConfigBot, Conversacion
from .gemini_service import generar_respuesta_gemini


FRASES_PASO_1 = (
    'quiero mas informacion',
    'quiero más información',
    'mas informacion',
    'más información',
    'informacion',
    'información',
    'info',
    'hola',
    'hi',
    'buenas',
    'buenos dias',
    'buenos días',
    'buenas tardes',
    'buenas noches',
    'catalogo',
    'catálogo',
    'productos',
    'estilos',
    'menu',
    'menú',
    'ayuda',
)


class BotEngine:
    def __init__(self, conversacion: Conversacion):
        self.conv = conversacion
        self.cfg = ConfigBot.obtener()
        self.mostro_catalogo = False

    # ---------- helpers ----------
    def _ctx(self):
        return dict(self.conv.contexto or {})

    def _save_ctx(self, ctx):
        self.conv.contexto = ctx
        self.conv.save(update_fields=['contexto', 'ultima_actividad'])

    def _reset(self):
        self.conv.contexto = {}
        self.conv.save(update_fields=['contexto', 'ultima_actividad'])

    def _saludo_por_hora(self, hora: int | None = None) -> str:
        if hora is None:
            hora = timezone.localtime().hour
        if hora < 12:
            return "¡Hola, muy buenos días!"
        if hora < 19:
            return "¡Hola, muy buenas tardes!"
        return "¡Hola, muy buenas noches!"

    def _mensaje_paso_1_catalogo(self, hora: int | None = None) -> str:
        self.mostro_catalogo = True
        ctx = self._ctx()
        ctx['iniciado'] = True
        self._save_ctx(ctx)
        saludo = self._saludo_por_hora(hora)
        return f"{saludo} Mire, por aquí le comparto el catálogo con los estilos disponibles para que lo mire con calma."

    def _stocks_disponibles(self):
        return Stock.objects.select_related('producto', 'producto__categoria').filter(cantidad__gt=0).order_by('producto__nombre', 'talla')

    def _buscar_stocks(self, texto):
        q = texto.strip().lower()
        if not q:
            return []
        res = []
        for s in self._stocks_disponibles():
            nombre = (s.producto.nombre or '').lower()
            talla = (s.talla or '').lower()
            if q in nombre or q in talla or nombre in q:
                res.append(s)
        return res

    def _fmt_stock(self, s):
        precio = s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0
        return f"{s.producto.nombre} - Talla {s.talla or 'única'} | ${precio} | Stock: {s.cantidad}"

    def _parse_int(self, texto):
        m = re.search(r'\d+', texto)
        if not m:
            return None
        try:
            return int(m.group(0))
        except ValueError:
            return None

    def _es_solicitud_inicial(self, low: str) -> bool:
        if low in FRASES_PASO_1:
            return True
        for frase in ('quiero mas info', 'quiero más info', 'mas info', 'más info', 'ver catalogo', 'ver catálogo', 'buenos d', 'buenas t', 'buenas n'):
            if frase in low:
                return True
        return False

    def _es_consulta_conversacional(self, low: str) -> bool:
        if '?' in low or '¿' in low:
            return True
        palabras_consulta = (
            'cuanto', 'cuánto', 'precio', 'vale', 'cuesta', 'tienes', 'tienen',
            'hay', 'disponible', 'recomienda', 'busco', 'quisiera saber',
            'hacen envio', 'hacen envío', 'envios', 'envíos', 'ubicacion',
            'ubicación', 'horario', 'tallas', 'colores', 'que vendes', 'qué vendes',
        )
        return any(p in low for p in palabras_consulta)

    # ---------- main ----------
    def responder(self, texto):
        texto = (texto or '').strip()
        if not texto:
            return "No entendí. ¿En qué te puedo ayudar?"

        if not self.cfg.activo:
            return "El chatbot está desactivado por ahora. Vuelve más tarde."

        low = texto.lower()
        if low in ('cancelar', 'cancela', 'reiniciar', 'empezar de nuevo', 'reset'):
            self._reset()
            return self._mensaje_paso_1_catalogo()

        ctx = self._ctx()
        phase = ctx.get('phase')

        # Paso 1: Si el cliente pide información / saluda / pide catálogo
        if phase is None and self._es_solicitud_inicial(low):
            return self._mensaje_paso_1_catalogo()

        # --- sin flujo activo: intentar identificar producto directo o responder con Gemini ---
        if phase is None:
            es_conversacional = self._es_consulta_conversacional(low)
            matches = [] if es_conversacional else self._buscar_stocks(texto)
            if len(matches) == 1:
                s = matches[0]
                ctx = {'iniciado': True, 'phase': 'cantidad', 'stock_id': s.id}
                self._save_ctx(ctx)
                precio = s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0
                return (f"Encontré: {s.producto.nombre} - Talla {s.talla or 'única'} a ${precio} "
                        f"(stock {s.cantidad}). ¿Cuántas unidades quieres?")
            if len(matches) > 1:
                ctx = {'iniciado': True, 'phase': 'elige_stock', 'opciones': [s.id for s in matches]}
                self._save_ctx(ctx)
                lines = ["Encontré varias opciones:"]
                for i, s in enumerate(matches, 1):
                    lines.append(f"{i}. {self._fmt_stock(s)}")
                lines.append("\nResponde con el número de la opción.")
                return "\n".join(lines)

            # Consultar al cerebro de IA (Google Gemini) con el inventario real
            respuesta_ia, mostrar_cat = generar_respuesta_gemini(
                mensaje_usuario=texto,
                conversacion=self.conv,
                cfg=self.cfg,
            )
            if respuesta_ia:
                if mostrar_cat or not ctx.get('iniciado'):
                    self.mostro_catalogo = mostrar_cat or not ctx.get('iniciado')
                ctx['iniciado'] = True
                self._save_ctx(ctx)
                return respuesta_ia

            if not ctx.get('iniciado'):
                return self._mensaje_paso_1_catalogo()
            return ("No encontré ese estilo. Mire el catálogo de arriba o escríbanos el nombre del producto que le gustó.")

        # --- elegir stock de varias opciones ---
        if phase == 'elige_stock':
            idx = self._parse_int(texto)
            opciones = ctx.get('opciones', [])
            if idx is not None and 1 <= idx <= len(opciones):
                stock_id = opciones[idx - 1]
                s = Stock.objects.select_related('producto').get(id=stock_id)
                ctx = {'iniciado': True, 'phase': 'cantidad', 'stock_id': s.id}
                self._save_ctx(ctx)
                precio = s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0
                return (f"Seleccionaste: {s.producto.nombre} - Talla {s.talla or 'única'} a ${precio} "
                        f"(stock {s.cantidad}). ¿Cuántas unidades quieres?")
            return "Responde con el número de la opción (1, 2, ...)."

        # --- cantidad ---
        if phase == 'cantidad':
            cant = self._parse_int(texto)
            if cant is None or cant <= 0:
                return "Dime una cantidad válida (número mayor a 0)."
            s = Stock.objects.select_related('producto').get(id=ctx['stock_id'])
            if cant > s.cantidad:
                return f"Solo hay {s.cantidad} unidades disponibles. ¿Cuántas quieres?"
            ctx['cantidad'] = cant
            ctx['phase'] = 'entrega'
            self._save_ctx(ctx)
            return "¿Envío a domicilio o recogida en tienda? (responde 'envio' o 'recogida')"

        # --- entrega ---
        if phase == 'entrega':
            if 'envio' in low or 'envío' in low or 'domicilio' in low:
                ctx['entrega'] = 'envio'
                ctx['phase'] = 'datos'
                self._save_ctx(ctx)
                return ("Para el envío necesito tus datos en un solo mensaje, separados por comas:\n"
                        "nombre, dirección, barrio, ciudad")
            if 'recogida' in low or 'recoger' in low or 'tienda' in low:
                ctx['entrega'] = 'recogida'
                ctx['phase'] = 'datos'
                self._save_ctx(ctx)
                return "Para la recogida necesito solo tu nombre. (Envíalo en un mensaje)"
            return "Responde 'envio' para envío a domicilio o 'recogida' para recoger en tienda."

        # --- datos ---
        if phase == 'datos':
            entrega = ctx.get('entrega')
            if entrega == 'envio':
                partes = [p.strip() for p in texto.split(',')]
                if len(partes) < 4:
                    return ("Faltan datos. Envíalos separados por comas:\n"
                            "nombre, dirección, barrio, ciudad")
                ctx['nombre'] = partes[0]
                ctx['direccion'] = partes[1]
                ctx['barrio'] = partes[2]
                ctx['ciudad'] = partes[3]
            else:
                ctx['nombre'] = texto.strip()
                ctx['direccion'] = ''
                ctx['barrio'] = ''
                ctx['ciudad'] = ''
            ctx['phase'] = 'confirma'
            self._save_ctx(ctx)
            s = Stock.objects.select_related('producto').get(id=ctx['stock_id'])
            precio = s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0
            total = (Decimal(str(precio)) * Decimal(str(ctx['cantidad']))).quantize(Decimal('0.01'))
            resumen = (f"Resumen de tu pedido:\n"
                       f"- Producto: {s.producto.nombre} - Talla {s.talla or 'única'}\n"
                       f"- Cantidad: {ctx['cantidad']}\n"
                       f"- Precio unitario: ${precio}\n"
                       f"- Total: ${total}\n"
                       f"- Entrega: {'Envío a domicilio' if entrega == 'envio' else 'Recogida en tienda'}\n"
                       f"- Cliente: {ctx['nombre']}")
            if entrega == 'envio':
                resumen += f"\n- Dirección: {ctx['direccion']}, {ctx['barrio']}, {ctx['ciudad']}"
            resumen += "\n\n¿Confirmas la compra? (responde 'si' o 'no')"
            return resumen

        # --- confirmación ---
        if phase == 'confirma':
            if low in ('si', 'sí', 'confirmo', 'ok', 'dale', 'claro'):
                try:
                    venta = StockService.procesar_venta(
                        stock_id=ctx['stock_id'],
                        cantidad_a_vender=ctx['cantidad'],
                        datos_cliente={
                            'nombre_cliente': ctx.get('nombre', ''),
                            'telefono_cliente': self.conv.telefono_cliente or self.conv.chat_id,
                            'direccion': ctx.get('direccion', ''),
                            'barrio': ctx.get('barrio', ''),
                            'ciudad': ctx.get('ciudad', ''),
                            'estado': 'pendiente',
                        },
                    )
                except ValidationError as e:
                    self._reset()
                    return f"No pude procesar la venta: {e}. ¿Quieres intentar de nuevo?"
                except Exception as e:
                    self._reset()
                    return f"Ocurrió un error al procesar la venta: {e}"
                self._reset()
                return (f"¡Venta registrada con éxito! (Venta #{venta.id})\n"
                        f"Total: ${venta.total_venta}\n"
                        "Gracias por tu compra. Te contactaremos para coordinar la entrega.")
            if low in ('no', 'cancelar', 'cancela'):
                self._reset()
                return "Pedido cancelado. ¿Quieres ver otro producto?"
            return "Responde 'si' para confirmar o 'no' para cancelar."

        # fallback
        self._reset()
        return self._mensaje_paso_1_catalogo()
