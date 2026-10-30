import { useEffect, useState } from 'react';
import {
  BookOpen,
  Search,
  RefreshCw,
  Image as ImageIcon,
  X,
  Tag,
  Layers,
} from 'lucide-react';
import { chatbotService } from '../services/chatbotService';
import type { Stock } from '../types';

const formatearUrlImagen = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.length > 500) return `data:image/png;base64,${url}`;
  return `${url.startsWith('/') ? '' : '/'}${url}`;
};

export const CatalogoManager = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todas');
  const [imagenAmpliada, setImagenAmpliada] = useState<{ url: string; titulo: string } | null>(null);

  const cargarCatalogo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await chatbotService.getCatalogo();
      setStocks(data.filter((s) => s.cantidad > 0));
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogo();
  }, []);

  const categorias = [
    'Todas',
    ...Array.from(
      new Set(stocks.map((s) => s.producto_detail?.categoria?.nombre || 'General'))
    ),
  ];

  const stocksFiltrados = stocks.filter((s) => {
    const prod = s.producto_detail;
    const nombre = (prod?.nombre || String(s.producto) || '').toLowerCase();
    const categoria = prod?.categoria?.nombre || 'General';
    const talla = (s.talla || prod?.talla || '').toLowerCase();
    const q = busqueda.trim().toLowerCase();

    const coincideCategoria = categoriaActiva === 'Todas' || categoria === categoriaActiva;
    const coincideBusqueda = !q || nombre.includes(q) || talla.includes(q) || categoria.toLowerCase().includes(q);
    return coincideCategoria && coincideBusqueda;
  });

  const totalUnidades = stocksFiltrados.reduce((acc, s) => acc + (s.cantidad || 0), 0);

  return (
    <div className="space-y-5">
      {/* CABECERA */}
      <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <BookOpen className="text-indigo-400" size={24} />
            <span>Catálogo de Productos</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Estilos disponibles en inventario con precios de venta y existencias en tiempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <Layers size={14} className="text-indigo-400" />
            <span>
              <strong className="text-white">{stocksFiltrados.length}</strong> referencias
            </span>
            <span className="text-slate-600">•</span>
            <span>
              <strong className="text-emerald-400">{totalUnidades}</strong> uds disponibles
            </span>
          </div>

          <button
            type="button"
            onClick={cargarCatalogo}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-400' : ''} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO DE CATEGORÍAS */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg space-y-3">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre del producto, talla o categoría..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaActiva(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                categoriaActiva === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* GRILLA DE TARJETAS DEL CATÁLOGO */}
      {loading && stocks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <RefreshCw className="animate-spin text-indigo-400 mx-auto mb-3" size={28} />
          <p className="text-sm text-slate-300 font-medium">Cargando catálogo de productos...</p>
        </div>
      ) : stocksFiltrados.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <BookOpen className="text-slate-600 mx-auto mb-2" size={32} />
          <p className="text-sm text-slate-400">No se encontraron productos disponibles con ese filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stocksFiltrados.map((s) => {
            const prod = s.producto_detail;
            const nombreProd = prod?.nombre || String(s.producto);
            const categoriaNombre = prod?.categoria?.nombre || 'General';
            const imgUrl = formatearUrlImagen(prod?.imagen);
            const talla = s.talla || prod?.talla || 'Única';
            const precio = Number(s.precio_comercial || prod?.precio_comercial || prod?.precio || 0);

            return (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between transition group"
              >
                <div>
                  <div
                    onClick={() =>
                      imgUrl && setImagenAmpliada({ url: imgUrl, titulo: `${nombreProd} - Talla ${talla}` })
                    }
                    className="h-44 w-full bg-slate-950 flex items-center justify-center overflow-hidden relative cursor-pointer"
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={nombreProd}
                        className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <ImageIcon className="text-slate-700" size={36} />
                    )}

                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 text-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-lg">
                      <Tag size={10} className="text-indigo-400" />
                      {categoriaNombre}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-2">
                    <h3
                      className="text-sm font-bold text-slate-100 line-clamp-1"
                      title={nombreProd}
                    >
                      {nombreProd}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-slate-400 gap-1">
                      <span className="truncate" title={talla}>
                        Tallas: <strong className="text-indigo-300">{talla}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium text-[11px] shrink-0">
                        {s.cantidad} disp.
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-800/80 flex items-baseline justify-between">
                      <span className="text-[11px] text-slate-400">Precio</span>
                      <span className="text-base font-extrabold text-emerald-400">
                        ${precio.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA AMPLIAR IMAGEN */}
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
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={imagenAmpliada.url}
              alt={imagenAmpliada.titulo}
              className="w-full max-h-[75vh] object-contain rounded-xl bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};
