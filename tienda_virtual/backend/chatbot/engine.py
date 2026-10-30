import re
import unicodedata
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone

from stock.models import Stock
from stock.services import StockService

from .models import ConfigBot, Conversacion, PARRILA_PRECIOS_DEFAULT
from .gemini_service import (
    agrupar_stocks_por_diseno,
    categoria_key,
    detectar_contexto_producto,
    extraer_nombre_base_y_talla,
    fmt_cop,
    formatear_parrilla,
    generar_respuesta_gemini,
    obtener_qs_oversize,
)


def _norm(texto: str) -> str:
    return re.sub(r'\s+', ' ', (texto or '').lower()).strip()


def _sin_acentos(texto: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')


class BotEngine:
    def __init__(self, conversacion: Conversacion):
        self.conv = conversacion
        self.cfg = ConfigBot.obtener()
        self.mostro_catalogo = False
        self.catalogo_categoria = None

    # ---------- helpers ----------
    def _ctx(self):
        return dict(self.conv.contexto or {})

    def _save_ctx(self, ctx):
        self.conv.contexto = ctx
        self.conv.save(update_fields=['contexto', 'ultima_actividad'])

    def _reset(self, keep_saludo: bool = True):
        self.conv.contexto = {'iniciado': True, 'saludado': True} if keep_saludo else {}
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
        ctx['saludado'] = True
        self._save_ctx(ctx)
        saludo = self._saludo_por_hora(hora)
        return f"{saludo} Mire, por aquí le comparto el catálogo con los estilos disponibles para que lo mire con calma."

    def _stocks_disponibles(self):
        ctx = self._ctx()
        return obtener_qs_oversize(incluir_imagen=False, categoria_filtro=ctx.get('categoria_actual'))

    def _grupos(self):
        return agrupar_stocks_por_diseno(self._stocks_disponibles())

    def _grupo_por_diseno(self, nombre):
        if not nombre:
            return None
        objetivo = _norm(nombre)
        for g in self._grupos():
            if _norm(g['nombre_base']) == objetivo:
                return g
        return None

    def _buscar_grupos(self, texto, categoria=None):
        q = _norm(texto)
        if not q or len(q) < 2:
            return []
        if categoria:
            grupos = agrupar_stocks_por_diseno(
                obtener_qs_oversize(incluir_imagen=False, categoria_filtro=categoria)
            )
        else:
            grupos = self._grupos()
        exactos, parciales = [], []
        for g in grupos:
            base = _norm(g['nombre_base'])
            if not base:
                continue
            if q == base:
                exactos.append(g)
            elif len(base) >= 4 and re.search(
                rf'(?<![a-z0-9áéíóúüñ]){re.escape(base)}(?![a-z0-9áéíóúüñ])', q
            ):
                parciales.append(g)
        return exactos or parciales

    def _precio_unidad(self, s: Stock):
        return s.precio_comercial or s.producto.precio_comercial or s.producto.precio or 0

    def _stock_actual(self, ctx):
        stock_id = ctx.get('stock_id')
        if not stock_id:
            return None
        return (
            Stock.objects.select_related('producto', 'producto__categoria')
            .defer('producto__imagen', 'producto__imagen_guia_tallas')
            .filter(id=stock_id)
            .first()
        )

    def _parse_int(self, texto):
        m = re.search(r'\d+', texto)
        if not m:
            return None
        try:
            return int(m.group(0))
        except ValueError:
            return None

    def _parse_talla(self, texto):
        low = _norm(texto)
        m = re.search(r'\b(XXXL|XXL|3XL|2XL|XL|L|M|S)\b', low, flags=re.IGNORECASE)
        if m:
            return m.group(1).upper()
        m = re.search(r'\b(3[5-9]|4[0-6])\b', low)
        if m:
            return m.group(1)
        return None

    def _es_solicitud_catalogo(self, low: str) -> bool:
        plano = _sin_acentos(low)
        frases_catalogo = (
            'catalogo',
            'fotos',
            'foto',
            'modelos',
            'estilos',
            'ver disenos',
            'muestrame los disenos',
            'muestrame disenos',
        )
        return any(f in plano for f in frases_catalogo)

    def _es_consulta_conversacional(self, low: str) -> bool:
        if '?' in low or '¿' in low:
            return True
        if low in ('hola', 'hola.', 'hi', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches'):
            return True
        if low in ('s', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl'):
            return True
        if re.match(r'^(talla|en talla|soy talla|uso|uso talla|soy)\s+(s|m|l|xl|xxl|xxxl|2xl|3xl)\b', low):
            return True
        palabras_consulta = (
            'cuanto', 'cuánto', 'precio', 'vale', 'cuesta', 'tienes', 'tienen',
            'hay', 'disponible', 'recomienda', 'envio', 'envío', 'ubicacion',
            'ubicación', 'horario', 'tallas', 'talla', 'colores', 'que vendes',
            'qué vendes', 'cuales', 'cuáles', 'informacion', 'información', 'info', 'ayuda',
        )
        return any(p in low for p in palabras_consulta)

    def _es_pregunta_auxiliar(self, low: str) -> bool:
        if '?' in low or '¿' in low:
            return True
        claves = (
            'envio', 'envío', 'domicilio', 'pago', 'contraentrega', 'contra entrega',
            'contra-entrega', 'guia', 'guía', 'despacho', 'demora', 'tarda',
            'descuento', 'promo', 'garantia', 'garantía', 'ubicacion', 'ubicación',
            'color', 'medida', 'cambiar', 'cambio',
        )
        return any(k in low for k in claves)

    def _respuesta_auxiliar(self, texto: str, ctx: dict, pendiente: str) -> str:
        respuesta, _ = generar_respuesta_gemini(
            mensaje_usuario=texto,
            conversacion=self.conv,
            cfg=self.cfg,
            ctx=ctx,
            ya_saludado=True,
            modo_auxiliar=True,
        )
        if respuesta:
            return f"{respuesta} {pendiente}"
        return pendiente

    def _parrilla_total(self, ctx: dict, cantidad: int):
        """Calcula el total con la parrilla oficial de paquetes. (total, error)."""
        grid = self.cfg.precios_paquetes or PARRILA_PRECIOS_DEFAULT
        key = categoria_key(ctx.get('categoria_actual'))
        if not key or key not in grid:
            return None, None

        paquetes_raw = (grid[key] or {}).get('paquetes') or {}
        paquetes = {int(k): int(v) for k, v in paquetes_raw.items()}
        if not paquetes:
            return None, None

        minimo = min(paquetes)
        if cantidad < minimo:
            opciones = ' · '.join(f"{c} por {fmt_cop(p)}" for c, p in sorted(paquetes.items()))
            return None, f"El mínimo es {minimo} camisas, veci: {opciones}."

        # Menor costo posible combinando los paquetes disponibles
        infinito = float('inf')
        dp = [infinito] * (cantidad + 1)
        dp[0] = 0
        for i in range(1, cantidad + 1):
            for tamano, precio in paquetes.items():
                if i >= tamano and dp[i - tamano] + precio < dp[i]:
                    dp[i] = dp[i - tamano] + precio
        if dp[cantidad] == infinito:
            return None, f"No tengo un paquete para {cantidad} unidades, veci. ¿Ajustamos la cantidad?"
        return int(dp[cantidad]), None

    def _total_pedido(self, stock: Stock, cantidad: int, ctx: dict):
        total, error = self._parrilla_total(ctx, cantidad)
        if error:
            return None, error
        if total is None:
            total = int(round(float(self._precio_unidad(stock)) * cantidad))
        return total, None

    def _pregunta_cantidad(self, ctx: dict, grupo: dict) -> str:
        parrilla = formatear_parrilla(ctx.get('categoria_actual'), self.cfg)
        if parrilla:
            return f"¿Cuántas te llevas, veci? {parrilla}."
        return "¿Cuántas unidades quieres?"

    def _pedir_talla(self, grupo: dict) -> str:
        tallas = grupo.get('tallas_lista') or ['Única']
        return f"¿Qué talla te queda, veci? Tenemos {', '.join(tallas)}."

    def _stock_de_grupo(self, grupo: dict, talla: str):
        mapa = grupo.get('stocks_por_talla') or {}
        for t, s in mapa.items():
            if _norm(t) == _norm(talla):
                return s
        return grupo.get('stock_representativo')

    def _iniciar_seleccion(self, grupo: dict, ctx: dict) -> str:
        s0 = grupo['stock_representativo']
        ya_saludo = bool(ctx.get('saludado')) or self.conv.mensajes.filter(autor='bot').exists()
        prefijo = '' if ya_saludo else f"{self._saludo_por_hora()} "
        categoria = s0.producto.categoria.nombre if s0.producto.categoria else None
        ctx.update({
            'iniciado': True,
            'saludado': True,
            'diseno_actual': grupo['nombre_base'],
            'producto_actual': f"Camisa diseño {grupo['nombre_base']}",
            'categoria_actual': categoria or ctx.get('categoria_actual'),
            'talla': None,
        })

        tallas = grupo.get('tallas_lista') or []
        if len(tallas) > 1:
            ctx['phase'] = 'talla'
            self._save_ctx(ctx)
            return prefijo + self._pedir_talla(grupo)

        talla = tallas[0] if tallas else (s0.talla or 'Única')
        stock = self._stock_de_grupo(grupo, talla)
        ctx.update({'phase': 'cantidad', 'stock_id': stock.id, 'talla': talla})
        self._save_ctx(ctx)
        return prefijo + self._pregunta_cantidad(ctx, grupo)

    def _resumen_pedido(self, stock: Stock, ctx: dict) -> str:
        talla = ctx.get('talla') or stock.talla or 'Única'
        total = ctx.get('total') or 0
        grid = self.cfg.precios_paquetes or PARRILA_PRECIOS_DEFAULT
        con_envio = categoria_key(ctx.get('categoria_actual')) in grid
        lineas = [
            f"Resumen, veci: {ctx.get('cantidad')} × {ctx.get('diseno_actual') or stock.producto.nombre} (talla {talla}).",
            f"Total: {fmt_cop(total)}{' con envío incluido' if con_envio else ''}.",
            f"Envío a: {ctx.get('nombre', '')} — {ctx.get('direccion', '')}, {ctx.get('barrio', '')}, {ctx.get('ciudad', '')}.",
            "¿Confirmas el pedido?",
        ]
        return "\n".join(lineas)

    def _responder_gemini(self, texto: str, ctx: dict, ya_saludado: bool) -> str:
        respuesta_ia, mostrar_cat = generar_respuesta_gemini(
            mensaje_usuario=texto,
            conversacion=self.conv,
            cfg=self.cfg,
            ctx=ctx,
            ya_saludado=ya_saludado,
        )
        if respuesta_ia is not None:
            if mostrar_cat:
                # El catálogo se envía solo con fotografías, sin texto adicional
                self.mostro_catalogo = True
                self.catalogo_categoria = ctx.get('categoria_actual')
                respuesta_ia = ''
            ctx['iniciado'] = True
            ctx['saludado'] = True
            self._save_ctx(ctx)
            return respuesta_ia
        if not ctx.get('iniciado'):
            return self._mensaje_paso_1_catalogo()
        return "No entendí, veci. ¿Me repites qué producto te interesa?"

    # ---------- main ----------
    def responder(self, texto):
        texto = (texto or '').strip()
        if not texto:
            return "¿En qué te puedo ayudar, veci?"

        if not self.cfg.activo:
            return "El chatbot está desactivado por ahora. Vuelve más tarde."

        low = _norm(texto)
        ctx = self._ctx()
        phase = ctx.get('phase')

        if low in ('cancelar', 'cancela', 'reiniciar', 'empezar de nuevo', 'reset'):
            self._reset(keep_saludo=True)
            return self._mensaje_paso_1_catalogo()

        if phase is None:
            ctx = detectar_contexto_producto(texto, ctx)
        elif any(k in low for k in ('oversize', 'mujer', 'licrada', 'zapatilla', 'yogger', 'chaqueta')):
            ctx = detectar_contexto_producto(texto, ctx)

        ya_saludado = bool(ctx.get('saludado')) or self.conv.mensajes.filter(autor='bot').exists()

        # Compatibilidad con la frase histórica de inicio
        if phase is None and low in ('quiero mas informacion', 'quiero más información'):
            return self._mensaje_paso_1_catalogo()

        # Catálogo: solo fotografías de la categoría solicitada, sin texto adicional
        if phase is None and self._es_solicitud_catalogo(low):
            self.mostro_catalogo = True
            self.catalogo_categoria = ctx.get('categoria_actual') or 'Camisas Oversize Hombre'
            ctx['iniciado'] = True
            ctx['saludado'] = True
            self._save_ctx(ctx)
            return ""

        # --- sin flujo activo ---
        if phase is None:
            if self._es_consulta_conversacional(low):
                return self._responder_gemini(texto, ctx, ya_saludado)

            grupos = self._buscar_grupos(texto, ctx.get('categoria_actual'))
            if len(grupos) == 1:
                return self._iniciar_seleccion(grupos[0], ctx)
            if len(grupos) > 1:
                opciones = [g['nombre_base'] for g in grupos[:5]]
                ctx.update({
                    'iniciado': True,
                    'saludado': True,
                    'phase': 'elige_diseno',
                    'opciones_diseno': opciones,
                })
                self._save_ctx(ctx)
                return f"Encontré varios diseños, veci: {', '.join(opciones)}. ¿Cuál te gusta?"

            return self._responder_gemini(texto, ctx, ya_saludado)

        # --- elegir diseño de una lista ---
        if phase == 'elige_diseno':
            opciones = ctx.get('opciones_diseno') or []
            idx = self._parse_int(texto)
            if idx is not None and 1 <= idx <= len(opciones):
                grupo = self._grupo_por_diseno(opciones[idx - 1])
                if grupo:
                    return self._iniciar_seleccion(grupo, ctx)
            for nombre in opciones:
                if _norm(nombre) in low:
                    grupo = self._grupo_por_diseno(nombre)
                    if grupo:
                        return self._iniciar_seleccion(grupo, ctx)
            if self._es_pregunta_auxiliar(low):
                return self._respuesta_auxiliar(texto, ctx, f"¿Cuál te gusta, veci: {', '.join(opciones)}?")
            return f"¿Cuál de estos diseños te gusta, veci: {', '.join(opciones)}?"

        # --- elegir talla ---
        if phase == 'talla':
            grupo = self._grupo_por_diseno(ctx.get('diseno_actual'))
            if not grupo:
                self._reset(keep_saludo=True)
                return "¿Qué producto te interesa, veci?"
            tallas_validas = grupo.get('tallas_lista') or []
            talla = self._parse_talla(texto)
            if talla:
                for t in tallas_validas:
                    if _norm(t) == _norm(talla):
                        stock = self._stock_de_grupo(grupo, t)
                        ctx.update({'phase': 'cantidad', 'stock_id': stock.id, 'talla': t})
                        self._save_ctx(ctx)
                        return self._pregunta_cantidad(ctx, grupo)
                return f"No tengo talla {talla}, veci. ¿Te sirve alguna de estas: {', '.join(tallas_validas)}?"
            if self._es_pregunta_auxiliar(low):
                return self._respuesta_auxiliar(texto, ctx, self._pedir_talla(grupo))
            return self._pedir_talla(grupo)

        # --- cantidad ---
        if phase == 'cantidad':
            stock = self._stock_actual(ctx)
            if not stock:
                self._reset(keep_saludo=True)
                return "Perdí el producto, veci. ¿Qué diseño te interesa?"
            cant = self._parse_int(texto) if ('?' not in low and '¿' not in low) else None
            if cant is None or cant <= 0:
                if self._es_pregunta_auxiliar(low):
                    return self._respuesta_auxiliar(texto, ctx, "¿Cuántas unidades te llevas, veci?")
                return "Dime un número, veci. ¿Cuántas unidades quieres?"
            if cant > stock.cantidad:
                return (f"Solo quedan {stock.cantidad} en talla {ctx.get('talla') or stock.talla or 'única'}, "
                        f"veci. ¿Cuántas te llevas?")
            total, error = self._total_pedido(stock, cant, ctx)
            if error:
                return error
            ctx.update({'cantidad': cant, 'total': total, 'phase': 'datos'})
            self._save_ctx(ctx)
            return "Perfecto, veci. Envíame tus datos en un solo mensaje: nombre, dirección, barrio, ciudad."

        # --- datos de envío ---
        if phase == 'datos':
            partes = [p.strip() for p in texto.split(',')]
            if len(partes) >= 4:
                ctx.update({
                    'nombre': partes[0],
                    'direccion': partes[1],
                    'barrio': partes[2],
                    'ciudad': partes[3],
                    'phase': 'confirma',
                })
                self._save_ctx(ctx)
                stock = self._stock_actual(ctx)
                if not stock:
                    self._reset(keep_saludo=True)
                    return "Perdí el producto, veci. ¿Qué diseño te interesa?"
                return self._resumen_pedido(stock, ctx)
            if self._es_pregunta_auxiliar(low):
                return self._respuesta_auxiliar(
                    texto, ctx, "Envíame tus datos en un solo mensaje: nombre, dirección, barrio, ciudad."
                )
            return "Necesito 4 datos separados por comas, veci: nombre, dirección, barrio, ciudad."

        # --- confirmación ---
        if phase == 'confirma':
            if low in ('si', 'sí', 'confirmo', 'confirmar', 'ok', 'dale', 'claro', 'listo'):
                stock = self._stock_actual(ctx)
                if not stock:
                    self._reset(keep_saludo=True)
                    return "Perdí el producto, veci. ¿Qué diseño te interesa?"
                try:
                    venta = StockService.procesar_venta(
                        stock_id=stock.id,
                        cantidad_a_vender=ctx.get('cantidad') or 1,
                        datos_cliente={
                            'nombre_cliente': ctx.get('nombre', ''),
                            'telefono_cliente': self.conv.telefono_cliente or self.conv.chat_id,
                            'direccion': ctx.get('direccion', ''),
                            'barrio': ctx.get('barrio', ''),
                            'ciudad': ctx.get('ciudad', ''),
                            'estado': 'pendiente',
                        },
                        total_venta_override=ctx.get('total'),
                    )
                except ValidationError as e:
                    self._reset(keep_saludo=True)
                    return f"No pude procesar la venta: {e}. ¿Quieres intentar de nuevo?"
                except Exception as e:
                    self._reset(keep_saludo=True)
                    return f"Ocurrió un error al procesar la venta: {e}"
                self._reset(keep_saludo=True)
                return (f"¡Listo, veci! Pedido #{venta.id} confirmado por {fmt_cop(venta.total_venta)}. "
                        f"Pago contra entrega; te envío la guía apenas se despache.")
            if low in ('no', 'cancelar', 'cancela'):
                self._reset(keep_saludo=True)
                return "Sin problema, veci. ¿Quieres ver otro diseño?"
            if self._es_pregunta_auxiliar(low):
                return self._respuesta_auxiliar(texto, ctx, "¿Confirmas el pedido, veci?")
            return "¿Confirmas el pedido, veci? Responde 'si' o 'no'."

        # fallback
        self._reset(keep_saludo=True)
        return "¿En qué te puedo ayudar, veci?"
