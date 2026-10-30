import { useEffect, useRef, useState } from 'react';
import { Bot, Circle, Send, Power, RefreshCw, Trash2, Sparkles, Image as ImageIcon, X } from 'lucide-react';

import { chatbotService } from '../services/chatbotService';
import type { ConfigBot } from '../services/chatbotService';
import type { Stock } from '../types';

interface MensajeSim {
  autor: 'cliente' | 'bot';
  texto: string;
  mostrarCatalogo?: boolean;
}

const SUGERENCIAS_RAPIDAS = [
  'Quiero más información',
  '¿Qué productos tienes disponibles y a qué precio?',
  'Catálogo',
  'Cancelar',
];

const formatearUrlImagen = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.length > 500) return `data:image/png;base64,${url}`;
  return `${url.startsWith('/') ? '' : '/'}${url}`;
};

export const ChatbotManager = () => {
  const [config, setConfig] = useState<ConfigBot | null>(null);
  const [chatId, setChatId] = useState<string>(() => `sim_${Date.now()}`);
  const [stocksDisponibles, setStocksDisponibles] = useState<Stock[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas');
  const [imagenAmpliada, setImagenAmpliada] = useState<{ url: string; titulo: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [mensajes, setMensajes] = useState<MensajeSim[]>([
    {
      autor: 'bot',
      texto:
        'Chat listo para probar. Escribe "quiero más información" (o haz clic en el botón rápido arriba) y presiona Enter.',
    },
  ]);
  const [enviando, setEnviando] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await chatbotService.getConfig();
      setConfig(c);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar la configuración del chatbot.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [mensajes, enviando]);

  const toggleActivo = async () => {
    if (!config) return;
    try {
      const c = await chatbotService.updateConfig({ activo: !config.activo });
      setConfig(c);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo actualizar el bot.');
    }
  };

  const cambiarModo = async (modo: 'autonomo' | 'revision') => {
    if (!config) return;
    try {
      const c = await chatbotService.updateConfig({ modo });
      setConfig(c);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo actualizar el modo.');
    }
  };

  const enviarTexto = async (textoAEnviar: string) => {
    const texto = textoAEnviar.trim();
    if (!texto || enviando) return;
    setInput('');
    setMensajes((m) => [...m, { autor: 'cliente', texto }]);
    setEnviando(true);
    try {
      const r = await chatbotService.simular(chatId, 'Cliente de prueba', texto);
      if (r.mostrar_catalogo && stocksDisponibles.length === 0) {
        setCargandoCatalogo(true);
        chatbotService
          .getCatalogo()
          .then((stocks) => setStocksDisponibles(stocks.filter((s) => s.cantidad > 0)))
          .catch(() => {})
          .finally(() => setCargandoCatalogo(false));
      }
      setMensajes((m) => [
        ...m,
        {
          autor: 'bot',
          texto: r.respuesta,
          mostrarCatalogo: Boolean(r.mostrar_catalogo),
        },
      ]);
    } catch (err: any) {
      setMensajes((m) => [
        ...m,
        { autor: 'bot', texto: `Error: ${err?.response?.data?.detail || 'No se pudo obtener respuesta del servidor'}` },
      ]);
    } finally {
      setEnviando(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    await enviarTexto(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarTexto(input);
    }
  };

  const limpiarChat = () => {
    setChatId(`sim_${Date.now()}`);
    setMensajes([
      {
        autor: 'bot',
        texto:
          'Chat nuevo iniciado. Escribe "Hola, quiero más información" y presiona Enter para conversar con el asesor IA y ver el catálogo de Oversizes.',
      },
    ]);
    inputRef.current?.focus();
  };

  const categoriasDisponibles = [
    'Todas',
    ...Array.from(
      new Set(
        stocksDisponibles.map((s) => s.producto_detail?.categoria?.nombre || 'General')
      )
    ),
  ];

  const stocksFiltrados =
    categoriaFiltro === 'Todas'
      ? stocksDisponibles
      : stocksDisponibles.filter(
          (s) => (s.producto_detail?.categoria?.nombre || 'General') === categoriaFiltro
        );

  return (
    <div className="space-y-4">
      {/* CABECERA COMPACTA CON CONTROLES */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex flex-wrap items-center gap-2">
            <Bot className="text-indigo-400" size={24} /> Chatbot — Chat de prueba
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles size={12} /> Gemini AI Conectado
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Chatea aquí con el robot impulsado por Google Gemini para consultar stock real y probar el flujo paso a paso
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleActivo}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
              config?.activo
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Circle
              size={8}
              className={config?.activo ? 'fill-emerald-400 text-emerald-400' : 'fill-slate-500 text-slate-500'}
            />
            {config?.activo ? 'Robot Activo' : 'Robot Desactivado'}
            <Power size={13} />
          </button>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => cambiarModo('autonomo')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                config?.modo === 'autonomo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Autónomo
            </button>
            <button
              type="button"
              onClick={() => cambiarModo('revision')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                config?.modo === 'revision' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Revisión
            </button>
          </div>

          <button
            type="button"
            onClick={cargar}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
            title="Recargar estado y catálogo"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
          {error}
        </p>
      )}

      {/* VENTANA PRINCIPAL DEL CHAT DE PRUEBA */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Barra superior del chat */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-sm font-semibold text-slate-100">Chat de prueba en vivo</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SUGERENCIAS_RAPIDAS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => enviarTexto(sug)}
                disabled={enviando}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer"
              >
                <Sparkles size={12} /> {sug}
              </button>
            ))}
            <button
              type="button"
              onClick={limpiarChat}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              title="Nuevo chat"
            >
              <Trash2 size={13} /> Nuevo chat
            </button>
          </div>
        </div>

        {/* Historial de mensajes */}
        <div
          ref={chatContainerRef}
          className="h-[400px] sm:h-[440px] overflow-y-auto p-4 space-y-4 bg-slate-950/60"
        >
          {mensajes.map((m, i) => (
            <div key={i} className={`flex ${m.autor === 'cliente' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-md ${
                  m.autor === 'cliente'
                    ? 'max-w-[85%] sm:max-w-[75%] bg-indigo-600 text-white rounded-br-sm'
                    : m.mostrarCatalogo
                    ? 'w-full max-w-[96%] bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-sm'
                    : 'max-w-[85%] sm:max-w-[75%] bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-sm'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">
                  {m.autor === 'cliente' ? 'Tú (Cliente)' : 'Robot Tienda'}
                </div>
                <div>{m.texto}</div>

                {/* Catálogo visual compartido por el robot en el Paso 1 */}
                {m.mostrarCatalogo && (
                  <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {categoriasDisponibles.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoriaFiltro(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                            categoriaFiltro === cat
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {cargandoCatalogo ? (
                      <p className="text-xs text-indigo-300 animate-pulse">Cargando catálogo de estilos disponibles...</p>
                    ) : stocksFiltrados.length === 0 ? (
                      <p className="text-xs text-slate-400">No hay estilos con stock disponible.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
                        {stocksFiltrados.map((s) => {
                          const prod = s.producto_detail;
                          const nombreProd = prod?.nombre || String(s.producto);
                          const imgUrl = formatearUrlImagen(prod?.imagen);
                          const precio = Number(s.precio_comercial || prod?.precio_comercial || prod?.precio || 0);
                          return (
                            <div
                              key={s.id}
                              className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2 flex flex-col justify-between gap-2 hover:border-indigo-500/60 transition"
                            >
                              <div>
                                <div
                                  onClick={() =>
                                    imgUrl && setImagenAmpliada({ url: imgUrl, titulo: `${nombreProd} (${s.talla || 'Única'})` })
                                  }
                                  className="h-28 w-full bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer"
                                >
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={nombreProd}
                                      className="w-full h-full object-contain hover:scale-105 transition"
                                    />
                                  ) : (
                                    <ImageIcon className="text-slate-600" size={24} />
                                  )}
                                </div>
                                <p className="mt-1.5 text-xs font-semibold text-slate-100 line-clamp-1" title={nombreProd}>
                                  {nombreProd}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5 gap-1">
                                  <span className="truncate" title={s.talla || 'Única'}>
                                    Tallas: <strong className="text-indigo-300">{s.talla || 'Única'}</strong>
                                  </span>
                                  <span className="shrink-0">Disp: {s.cantidad}</span>
                                </div>
                                <p className="text-xs font-bold text-emerald-400 mt-0.5">
                                  ${precio.toLocaleString('es-CO')}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => enviarTexto(nombreProd)}
                                className="w-full bg-indigo-600/20 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30 rounded-lg py-1 text-[11px] font-medium transition cursor-pointer"
                              >
                                Me interesa este
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-300 border border-slate-700/70 rounded-2xl px-4 py-2 text-xs animate-pulse">
                El robot está escribiendo...
              </div>
            </div>
          )}
        </div>

        {/* CAJA DE TEXTO PARA ESCRIBIR Y ENVIAR CON ENTER */}
        <form onSubmit={enviar} className="flex items-center gap-2 p-3 bg-slate-900 border-t border-slate-800">
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe aquí tu mensaje (ej: quiero más información) y presiona Enter..."
            className="flex-1 bg-slate-800 border-2 border-indigo-500/50 focus:border-indigo-400 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none transition"
          />
          <button
            type="submit"
            disabled={enviando || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/25 shrink-0"
          >
            <span>Enviar</span>
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Modal para ver foto ampliada */}
      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">{imagenAmpliada.titulo}</h3>
              <button
                type="button"
                onClick={() => setImagenAmpliada(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={imagenAmpliada.url}
              alt={imagenAmpliada.titulo}
              className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};
