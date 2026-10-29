import { useState, useEffect, useMemo } from 'react';
import { stockService } from '../services/stockService';
import type { Stock, Producto, Categoria } from '../types';
import { UbicacionBadge, formatearUbicacion } from '../utils/locationFormatter';
import { 
  Boxes, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Package, 
  Tag, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  FolderTree, 
  Search,
  ShoppingCart,
  Percent,
  X,
  DollarSign,
  Shirt,
  Maximize2,
  Check,
  TrendingUp,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';

export interface StockGroupedByCategory {
  [categoriaNombre: string]: Stock[];
}

export const StockManager = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtro de búsqueda y margen
  const [busqueda, setBusqueda] = useState('');
  const [porcentajeMargen, setPorcentajeMargen] = useState<number>(75);

  // Estado de acordeones desplegados (por nombre de categoría)
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<{ [categoria: string]: boolean }>({});

  // Formulario Entrada de Stock (4 campos estrictos)
  const [productoId, setProductoId] = useState<number | ''>('');
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | ''>('');
  const [talla, setTalla] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Modal / Diálogo de Venta
  const [stockParaVenta, setStockParaVenta] = useState<Stock | null>(null);
  const [cantidadVenta, setCantidadVenta] = useState<number>(1);
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteBarrio, setClienteBarrio] = useState('');
  const [clienteCiudad, setClienteCiudad] = useState('');
  const [numeroGuia, setNumeroGuia] = useState('');
  const [estadoEnvio, setEstadoEnvio] = useState('pendiente');

  // Lightbox modal para ampliar foto o guía de tallas
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // 1. Edición independiente de Costo (Precio Recibido), Precio Comercial y % Margen en tiempo real
  interface EditStockState {
    precio_recibido?: string;
    precio_comercial: string;
    porcentaje_margen: string;
    dirty: boolean;
    saving?: boolean;
  }
  const [edicionPorStock, setEdicionPorStock] = useState<{ [stockId: number]: EditStockState }>({});

  // 2. Modal de confirmación para Ajuste Rápido (+ / -)
  interface ConfirmacionAjuste {
    stock: Stock;
    productoNombre: string;
    tipo: 'agregar' | 'quitar';
    cantidadAjuste: number;
  }
  const [confirmacionAjuste, setConfirmacionAjuste] = useState<ConfirmacionAjuste | null>(null);
  const [procesandoAjuste, setProcesandoAjuste] = useState(false);

  // 3. Paginación estricta de 6 items por página para tablas de inventario
  const ITEMS_PER_PAGE = 6;
  const [paginaPorCategoria, setPaginaPorCategoria] = useState<{ [categoria: string]: number }>({});

  useEffect(() => {
    setPaginaPorCategoria({});
  }, [busqueda]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [stk, prods, cats] = await Promise.all([
        stockService.getStocks(),
        stockService.getProductos(),
        stockService.getCategorias(),
      ]);
      setStocks(stk);
      setProductos(prods);
      setCategorias(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const formatearUrlImagen = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const productoSeleccionado = productos.find((p) => p.id === Number(productoId));

  const handleSelectProducto = (idStr: string) => {
    if (!idStr) {
      setProductoId('');
      setSelectedCategoriaId('');
      setTalla('');
      return;
    }
    const idNum = Number(idStr);
    setProductoId(idNum);
    const prod = productos.find((p) => p.id === idNum);
    if (prod) {
      // Auto-selección inteligente de la categoría y la talla del producto
      setSelectedCategoriaId(prod.categoria?.id || prod.categoria_id || '');
      setTalla(prod.talla || '');
    }
  };

  // Calculadora de Precio Comercial en tiempo real
  const calcularPrecioComercial = (costo: number | string | undefined, margen: number): number => {
    const costoNum = Number(costo) || 0;
    return Math.round(costoNum * (1 + margen / 100) * 100) / 100;
  };

  // 1. Agrupación dinámica por categoría con soporte de búsqueda
  const stocksAgrupadosPorCategoria = useMemo<StockGroupedByCategory>(() => {
    const agrupado: StockGroupedByCategory = {};

    const stocksFiltrados = stocks.filter((s) => {
      if (!busqueda.trim()) return true;
      const query = busqueda.toLowerCase().trim();
      const prod = productos.find((p) => p.id === s.producto_id || String(p.id) === String(s.producto) || p.nombre === String(s.producto));
      const nombreProd = String(s.producto).toLowerCase();
      const catProd = (prod?.categoria?.nombre || 'sin categoría').toLowerCase();
      const posRaw = (prod?.posicion || '').toLowerCase();
      const filaRaw = (prod?.fila !== undefined && prod?.fila !== null ? String(prod.fila) : '').toLowerCase();
      const ubicacionFormateada = formatearUbicacion(prod?.posicion, prod?.fila).toLowerCase();
      const posProd = (s.ubicacion || `${prod?.posicion || ''}-${prod?.fila || ''}`).toLowerCase();
      const tallaProd = (s.talla || prod?.talla || '').toLowerCase();
      const descProd = (prod?.descripcion || '').toLowerCase();

      return (
        nombreProd.includes(query) ||
        catProd.includes(query) ||
        posProd.includes(query) ||
        posRaw.includes(query) ||
        filaRaw.includes(query) ||
        ubicacionFormateada.includes(query) ||
        tallaProd.includes(query) ||
        descProd.includes(query)
      );
    });

    stocksFiltrados.forEach((stock) => {
      const prod = productos.find((p) => p.id === stock.producto_id || String(p.id) === String(stock.producto) || p.nombre === String(stock.producto));
      const categoriaNombre = prod?.categoria?.nombre || 'Sin Categoría';

      if (!agrupado[categoriaNombre]) {
        agrupado[categoriaNombre] = [];
      }
      agrupado[categoriaNombre].push(stock);
    });

    return agrupado;
  }, [stocks, productos, busqueda]);

  // Inicializar categorías abiertas
  useEffect(() => {
    const categoriasKeys = Object.keys(stocksAgrupadosPorCategoria);
    if (categoriasKeys.length > 0) {
      setCategoriasAbiertas((prev) => {
        const nuevo: { [key: string]: boolean } = { ...prev };
        categoriasKeys.forEach((cat) => {
          if (nuevo[cat] === undefined) {
            nuevo[cat] = true;
          }
        });
        return nuevo;
      });
    }
  }, [stocksAgrupadosPorCategoria]);

  const toggleCategoria = (categoria: string) => {
    setCategoriasAbiertas((prev) => ({
      ...prev,
      [categoria]: !prev[categoria],
    }));
  };

  const toggleTodas = (abrir: boolean) => {
    const nuevo: { [key: string]: boolean } = {};
    Object.keys(stocksAgrupadosPorCategoria).forEach((cat) => {
      nuevo[cat] = abrir;
    });
    setCategoriasAbiertas(nuevo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeExito(null);
    setMensajeError(null);

    if (!productoId || !cantidad || Number(cantidad) <= 0) {
      setMensajeError('Por favor selecciona producto y una cantidad mayor a 0.');
      return;
    }

    try {
      const nuevoStock = await stockService.createStock({
        producto_id: Number(productoId),
        categoria_id: selectedCategoriaId ? Number(selectedCategoriaId) : undefined,
        talla: talla.trim() || undefined,
        cantidad: Number(cantidad),
        porcentaje_margen: porcentajeMargen,
      });

      const catAsignada = categorias.find((c) => c.id === Number(selectedCategoriaId))?.nombre;
      const tallaAsignada = nuevoStock.talla || talla || 'Sin talla';

      setMensajeExito(
        `¡Stock registrado! Producto en categoría '${catAsignada || 'Actual'}', Talla '${tallaAsignada}' con margen del ${porcentajeMargen}% (Total: ${nuevoStock.cantidad} uds disponibles).`
      );

      // Reset form
      setCantidad('');
      cargarDatos();
    } catch (err: any) {
      console.error(err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        'Error al ingresar o acumular existencias de stock.';
      setMensajeError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
  };

  // Control de Ajuste Rápido (+ / -) con Confirmación Visual
  const handleIniciarAjuste = (stock: Stock, tipo: 'agregar' | 'quitar') => {
    const prod = productos.find(
      (p) => p.id === stock.producto_id || String(p.id) === String(stock.producto) || p.nombre === String(stock.producto)
    );
    setConfirmacionAjuste({
      stock,
      productoNombre: prod?.nombre || String(stock.producto),
      tipo,
      cantidadAjuste: 1,
    });
  };

  const handleEjecutarAjusteConfirmado = async () => {
    if (!confirmacionAjuste) return;
    const { stock, tipo, cantidadAjuste, productoNombre } = confirmacionAjuste;
    const delta = tipo === 'agregar' ? cantidadAjuste : -cantidadAjuste;
    const nuevaCant = Math.max(0, stock.cantidad + delta);

    setProcesandoAjuste(true);
    try {
      await stockService.updateStock(stock.id, { cantidad: nuevaCant });
      setStocks((prev) =>
        prev.map((item) => (item.id === stock.id ? { ...item, cantidad: nuevaCant } : item))
      );
      setMensajeExito(
        `✅ Ajuste de stock exitoso: '${productoNombre}' actualizado a ${nuevaCant} uds (${tipo === 'agregar' ? `+${cantidadAjuste}` : `-${cantidadAjuste}`}).`
      );
      setConfirmacionAjuste(null);
    } catch (e) {
      console.error(e);
      setMensajeError('Error al actualizar la cantidad de stock.');
    } finally {
      setProcesandoAjuste(false);
    }
  };

  // Edición independiente de Costo (Precio Recibido), Precio Comercial y % Margen en tiempo real por producto
  const handleCambioPrecioRecibido = (stockId: number, nuevoCostoStr: string, margenActual: number) => {
    const nuevoCosto = parseFloat(nuevoCostoStr);
    let nuevoPrecio = 0;
    if (!isNaN(nuevoCosto) && nuevoCosto >= 0) {
      nuevoPrecio = Math.round(nuevoCosto * (1 + (margenActual || 0) / 100) * 100) / 100;
    }
    setEdicionPorStock((prev) => ({
      ...prev,
      [stockId]: {
        precio_recibido: nuevoCostoStr,
        precio_comercial: !isNaN(nuevoCosto) && nuevoCosto >= 0 ? String(nuevoPrecio) : (prev[stockId]?.precio_comercial || '0'),
        porcentaje_margen: prev[stockId]?.porcentaje_margen !== undefined ? prev[stockId].porcentaje_margen : String(margenActual || 75),
        dirty: true,
      },
    }));
  };

  const handleCambioPrecioComercial = (stockId: number, costo: number, nuevoPrecioStr: string) => {
    const nuevoPrecio = parseFloat(nuevoPrecioStr);
    const costoActual = edicionPorStock[stockId]?.precio_recibido !== undefined 
      ? parseFloat(edicionPorStock[stockId].precio_recibido!) 
      : costo;
    let nuevoMargen = 0;
    if (!isNaN(nuevoPrecio) && costoActual > 0) {
      nuevoMargen = Math.round(((nuevoPrecio - costoActual) / costoActual) * 10000) / 100;
    }
    setEdicionPorStock((prev) => ({
      ...prev,
      [stockId]: {
        ...prev[stockId],
        precio_comercial: nuevoPrecioStr,
        porcentaje_margen: !isNaN(nuevoPrecio) && costoActual > 0 ? String(nuevoMargen) : (prev[stockId]?.porcentaje_margen || '0'),
        dirty: true,
      },
    }));
  };

  const handleCambioMargen = (stockId: number, costo: number, nuevoMargenStr: string) => {
    const nuevoMargen = parseFloat(nuevoMargenStr);
    const costoActual = edicionPorStock[stockId]?.precio_recibido !== undefined 
      ? parseFloat(edicionPorStock[stockId].precio_recibido!) 
      : costo;
    let nuevoPrecio = 0;
    if (!isNaN(nuevoMargen)) {
      nuevoPrecio = Math.round(costoActual * (1 + nuevoMargen / 100) * 100) / 100;
    }
    setEdicionPorStock((prev) => ({
      ...prev,
      [stockId]: {
        ...prev[stockId],
        precio_comercial: !isNaN(nuevoMargen) ? String(nuevoPrecio) : (prev[stockId]?.precio_comercial || '0'),
        porcentaje_margen: nuevoMargenStr,
        dirty: true,
      },
    }));
  };

  const handleGuardarPrecioMargen = async (stock: Stock) => {
    const edit = edicionPorStock[stock.id];
    if (!edit || !edit.dirty) return;

    const prod = productos.find(
      (p) => p.id === stock.producto_id || String(p.id) === String(stock.producto) || p.nombre === String(stock.producto)
    );
    const costoOriginal = Number(stock.precio_recibido || prod?.precio_recibido || 0);

    const nuevoCosto = edit.precio_recibido !== undefined ? parseFloat(edit.precio_recibido) : costoOriginal;
    const nuevoPrecio = parseFloat(edit.precio_comercial);
    const nuevoMargen = parseFloat(edit.porcentaje_margen);

    if (isNaN(nuevoCosto) || nuevoCosto < 0) {
      setMensajeError('El costo (precio recibido) debe ser un número válido mayor o igual a 0.');
      return;
    }

    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      setMensajeError('El precio comercial debe ser un número válido mayor o igual a 0.');
      return;
    }

    setEdicionPorStock((prev) => ({
      ...prev,
      [stock.id]: { ...prev[stock.id], saving: true },
    }));

    try {
      const payload: Partial<Stock> = {
        precio_recibido: nuevoCosto,
        precio_comercial: nuevoPrecio,
        porcentaje_margen: isNaN(nuevoMargen) ? 0 : nuevoMargen,
      };

      const actualizado = await stockService.updateStock(stock.id, payload);

      setStocks((prev) =>
        prev.map((item) => (item.id === stock.id ? { ...item, ...actualizado } : item))
      );

      // Sincronizar catálogo local de productos para reflejar cambios en tiempo real
      setProductos((prev) =>
        prev.map((p) => {
          if (p.id === stock.producto_id || String(p.id) === String(stock.producto) || p.nombre === String(stock.producto)) {
            return {
              ...p,
              precio_recibido: nuevoCosto,
              precio_comercial: nuevoPrecio,
              precio: nuevoPrecio,
            };
          }
          return p;
        })
      );

      setEdicionPorStock((prev) => {
        const copia = { ...prev };
        delete copia[stock.id];
        return copia;
      });

      setMensajeExito(
        `✅ Valores actualizados para '${prod?.nombre || stock.producto}': Costo: $${nuevoCosto.toLocaleString()}, Venta: $${nuevoPrecio.toLocaleString()} (+${nuevoMargen}% margen comercial).`
      );
    } catch (err: any) {
      console.error(err);
      setMensajeError('Error al guardar el costo, precio o margen del producto.');
      setEdicionPorStock((prev) => ({
        ...prev,
        [stock.id]: { ...prev[stock.id], saving: false },
      }));
    }
  };

  const handleCancelarEdicion = (stockId: number) => {
    setEdicionPorStock((prev) => {
      const copia = { ...prev };
      delete copia[stockId];
      return copia;
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Deseas eliminar este registro de stock?')) return;
    try {
      await stockService.deleteStock(id);
      cargarDatos();
    } catch (e) {
      console.error(e);
    }
  };

  // ACCIÓN DE VENTA
  const handleAbrirModalVenta = (stock: Stock) => {
    setStockParaVenta(stock);
    setCantidadVenta(1);
    setMensajeError(null);
    setClienteTelefono('');
    setClienteNombre('');
    setClienteDireccion('');
    setClienteBarrio('');
    setClienteCiudad('');
    setNumeroGuia('');
    setEstadoEnvio('pendiente');
  };

  const handleConfirmarVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockParaVenta || cantidadVenta <= 0) return;

    if (cantidadVenta > stockParaVenta.cantidad) {
      alert(`No puedes vender más de ${stockParaVenta.cantidad} unidades disponibles.`);
      return;
    }

    setProcesandoVenta(true);
    try {
      const venta = await stockService.registrarVenta({
        stock_id: stockParaVenta.id,
        cantidad_vendida: cantidadVenta,
        telefono_cliente: clienteTelefono,
        nombre_cliente: clienteNombre,
        direccion: clienteDireccion,
        barrio: clienteBarrio,
        ciudad: clienteCiudad,
        numero_guia: numeroGuia,
        estado: estadoEnvio,
      });

      setMensajeExito(
        `✅ ¡Venta procesada! ${venta.cantidad_vendida || venta.cantidad} uds por un total de $${Number(venta.total_venta).toLocaleString()}. Stock descontado automáticamente.`
      );
      setStockParaVenta(null);
      cargarDatos();
    } catch (err: any) {
      console.error(err);
      const errDetail = err?.response?.data?.detail || err?.response?.data?.cantidad_vendida || 'Stock insuficiente para realizar la venta.';
      alert(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
    } finally {
      setProcesandoVenta(false);
    }
  };

  // Métricas consolidadas del inventario
  const totalUnidadesDisponibles = stocks.reduce((acc, curr) => acc + curr.cantidad, 0);
  const totalPrecioRecibido = stocks.reduce((acc, curr) => {
    const prod = productos.find((p) => p.id === curr.producto_id || String(p.id) === String(curr.producto) || p.nombre === String(curr.producto));
    const costo = Number(curr.precio_recibido || prod?.precio_recibido || 0);
    return acc + curr.cantidad * costo;
  }, 0);
  const totalPrecioComercial = stocks.reduce((acc, curr) => {
    const prod = productos.find((p) => p.id === curr.producto_id || String(p.id) === String(curr.producto) || p.nombre === String(curr.producto));
    const precio = Number(curr.precio_comercial || prod?.precio_comercial || prod?.precio || 0);
    return acc + curr.cantidad * precio;
  }, 0);

  const totalCategorias = Object.keys(stocksAgrupadosPorCategoria).length;

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Boxes className="text-indigo-400 shrink-0" size={24} /> <span>Control de Stock & Inventario (POS)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Inventario por categorías, fotos de prendas, guías de medidas, costos y precios comerciales
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-sm text-xs sm:text-sm">
            <span className="text-slate-400">Stock:</span>
            <span className="font-bold text-indigo-400 font-mono">{totalUnidadesDisponibles} uds</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-sm text-xs sm:text-sm">
            <span className="text-slate-400">Costo:</span>
            <span className="font-bold text-amber-400 font-mono">${totalPrecioRecibido.toLocaleString()}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-sm text-xs sm:text-sm">
            <span className="text-slate-400">Venta:</span>
            <span className="font-bold text-emerald-400 font-mono">${totalPrecioComercial.toLocaleString()}</span>
          </div>
          <button
            onClick={cargarDatos}
            className="p-2 sm:p-2.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
            title="Recargar inventario"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
          </button>
        </div>
      </div>

      {/* FORMULARIO SIMPLIFICADO DE 4 CAMPOS: PRODUCTO, CATEGORÍA, TALLA, CANTIDAD */}
      <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800/80 pb-3">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs sm:text-sm">
            <Plus size={16} className="text-indigo-400 shrink-0" /> Ingreso / Acumulación de Stock
          </h3>

          <div className="flex items-center gap-2 bg-slate-950 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
            <Percent size={14} className="text-indigo-400 shrink-0" />
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium">% Margen:</span>
            <input
              type="number"
              min="0"
              max="500"
              value={porcentajeMargen}
              onChange={(e) => setPorcentajeMargen(Number(e.target.value) || 0)}
              className="w-14 sm:w-16 bg-slate-900 border border-slate-700 rounded-lg px-1.5 sm:px-2 py-0.5 text-xs font-mono font-bold text-indigo-300 text-center focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
        </div>

        {mensajeExito && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs sm:text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={18} className="shrink-0" /> <span>{mensajeExito}</span>
          </div>
        )}

        {mensajeError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs sm:text-sm flex items-center gap-2 animate-fadeIn">
            <AlertCircle size={18} className="shrink-0" /> <span>{mensajeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. PRODUCTO */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">1. Producto</label>
              <select
                required
                value={productoId}
                onChange={(e) => handleSelectProducto(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Seleccionar Producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.talla ? `[Talla: ${p.talla}]` : ''} ({p.categoria?.nombre || 'Sin categoría'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. CATEGORÍA DEL PRODUCTO */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <FolderTree size={13} className="text-indigo-400" /> 2. Categoría
              </label>
              <select
                value={selectedCategoriaId}
                onChange={(e) => setSelectedCategoriaId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Seleccionar Categoría...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. TALLA DEL PRODUCTO */}
            <div>
              <label className="block text-xs font-semibold text-cyan-400 mb-1 flex items-center gap-1">
                <Shirt size={13} /> 3. Talla
              </label>
              <input
                type="text"
                placeholder="Ej: S, M, L, XL, 40"
                value={talla}
                onChange={(e) => setTalla(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 font-mono font-bold placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* 4. CANTIDAD A INGRESAR */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">4. Cantidad</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="10"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-5 rounded-xl font-medium flex items-center justify-center transition shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0"
                  title="Registrar Stock"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* TARJETA INTERACTIVA DE CONFIRMACIÓN CON CÁLCULO DE PRECIO COMERCIAL */}
          {productoSeleccionado && (
            <div className="p-3.5 sm:p-4 bg-slate-950/80 border border-indigo-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                {/* Miniatura foto principal */}
                {formatearUrlImagen(productoSeleccionado.imagen) ? (
                  <img
                    src={formatearUrlImagen(productoSeleccionado.imagen)!}
                    alt={productoSeleccionado.nombre}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-800 bg-slate-900 shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Package size={22} />
                  </div>
                )}

                {/* Miniatura Guía de tallas si existe */}
                {formatearUrlImagen(productoSeleccionado.imagen_guia_tallas) && (
                  <div 
                    onClick={() => setLightboxImage({ 
                      url: formatearUrlImagen(productoSeleccionado.imagen_guia_tallas)!, 
                      title: `Guía de Tallas: ${productoSeleccionado.nombre}` 
                    })}
                    className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-cyan-500/40 bg-slate-900 cursor-pointer group flex-shrink-0"
                    title="Ver Guía de Tallas ampliada"
                  >
                    <img
                      src={formatearUrlImagen(productoSeleccionado.imagen_guia_tallas)!}
                      alt="Guía de Tallas"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-cyan-950/60 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                      GUÍA
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-100">{productoSeleccionado.nombre}</div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-[11px] sm:text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-md text-slate-300">
                      <Tag size={11} className="text-indigo-400" />
                      <strong className="text-indigo-300">
                        {categorias.find((c) => c.id === Number(selectedCategoriaId))?.nombre ||
                          productoSeleccionado.categoria?.nombre ||
                          'Sin categoría'}
                      </strong>
                    </span>
                    {talla && (
                      <span className="inline-flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md font-mono font-bold">
                        <Shirt size={11} /> Talla: {talla}
                      </span>
                    )}
                    {(productoSeleccionado.posicion || productoSeleccionado.fila) && (
                      <UbicacionBadge posicion={productoSeleccionado.posicion} fila={productoSeleccionado.fila} />
                    )}
                  </div>
                </div>
              </div>

              {/* CÁLCULO DE COSTO Y PRECIO COMERCIAL EN VIVO */}
              <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 bg-slate-900 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 block">Costo</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    ${Number(productoSeleccionado.precio_recibido || 0).toLocaleString()}
                  </span>
                </div>
                <ArrowRight size={14} className="text-slate-600" />
                <div>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 block">Venta (+{porcentajeMargen}%)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ${calcularPrecioComercial(productoSeleccionado.precio_recibido || productoSeleccionado.precio, porcentajeMargen).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* BARRA DE HERRAMIENTAS: BÚSQUEDA Y CONTROLES DE ACORDEÓN */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 sm:p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por producto, categoría, talla o ubicación..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end sm:justify-start gap-2">
          <button
            type="button"
            onClick={() => toggleTodas(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            Expandir Todo
          </button>
          <button
            type="button"
            onClick={() => toggleTodas(false)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            Colapsar Todo
          </button>
        </div>
      </div>

      {/* SECCIÓN DE ACORDEONES POR CATEGORÍA */}
      {totalCategorias === 0 && !loading ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 sm:p-12 text-center text-slate-500 space-y-3">
          <Boxes size={40} className="mx-auto text-slate-600" />
          <p className="text-sm sm:text-base font-medium text-slate-400">
            {busqueda ? 'No se encontraron resultados para tu búsqueda.' : 'No hay registros de stock en el inventario.'}
          </p>
          <p className="text-xs text-slate-600">
            {busqueda ? 'Intenta con otro término de búsqueda.' : 'Ingresa stock usando el formulario de arriba.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(stocksAgrupadosPorCategoria).map(([categoriaNombre, items]) => {
            const estaAbierto = categoriasAbiertas[categoriaNombre] ?? true;
            const totalUnidadesCategoria = items.reduce((acc, curr) => acc + curr.cantidad, 0);

            return (
              <div
                key={categoriaNombre}
                className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg transition-all"
              >
                {/* CABECERA DEL ACORDEÓN */}
                <button
                  type="button"
                  onClick={() => toggleCategoria(categoriaNombre)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-slate-900 hover:bg-slate-850 transition cursor-pointer text-left border-b border-slate-800/80 gap-2 sm:gap-4"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                      <FolderTree size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
                        {categoriaNombre}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-400">
                        {items.length} {items.length === 1 ? 'registro' : 'registros'} de stock
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 bg-slate-800/80 border border-slate-700/60 rounded-full text-xs font-mono font-semibold text-emerald-400">
                      {totalUnidadesCategoria} unidades disponibles
                    </span>
                    <div className="p-1 text-slate-400 hover:text-white transition">
                      {estaAbierto ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </button>

                {/* CONTENIDO DESPLEGABLE: TABLA CON PRECIOS INDEPENDIENTES, MARGEN Y PAGINACIÓN */}
                {estaAbierto && (() => {
                  const paginaCat = paginaPorCategoria[categoriaNombre] || 1;
                  const totalPaginasCat = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
                  const itemsPaginados = items.slice((paginaCat - 1) * ITEMS_PER_PAGE, paginaCat * ITEMS_PER_PAGE);

                  return (
                    <div>
                      <div className="p-3 sm:p-4 space-y-3">
                        {itemsPaginados.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 text-xs sm:text-sm bg-slate-950/40 rounded-xl border border-slate-800/60">
                            No hay productos en esta página.
                          </div>
                        ) : (
                          itemsPaginados.map((s) => {
                            const prod = productos.find(
                              (p) => p.id === s.producto_id || String(p.id) === String(s.producto) || p.nombre === String(s.producto)
                            );
                            const imgUrl = formatearUrlImagen(prod?.imagen);
                            const imgGuiaUrl = formatearUrlImagen(prod?.imagen_guia_tallas);
                            const costoUnit = Number(s.precio_recibido || prod?.precio_recibido || 0);
                            const edit = edicionPorStock[s.id];
                            const ventaUnitNum = edit ? Number(edit.precio_comercial) : Number(s.precio_comercial || prod?.precio_comercial || prod?.precio || 0);
                            const margenValorNum = edit ? Number(edit.porcentaje_margen) : Number(s.porcentaje_margen ?? 75);
                            const gananciaUnitaria = Math.round((ventaUnitNum - costoUnit) * 100) / 100;
                            const gananciaTotal = Math.round((gananciaUnitaria * s.cantidad) * 100) / 100;
                            const tallaMostrada = s.talla || prod?.talla || 'Sin talla';

                            return (
                              <div
                                key={s.id}
                                className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-center p-3.5 sm:p-4 bg-gray-900/50 hover:bg-gray-900/80 rounded-xl border border-gray-800 transition-all shadow-sm"
                              >
                                {/* COLUMNA IZQUIERDA: FOTO, GUÍA, NOMBRE, TALLA, UBICACIÓN, STOCK */}
                                <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                                  {/* Imágenes */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {imgUrl ? (
                                      <div
                                        onClick={() => setLightboxImage({ url: imgUrl, title: `Foto: ${prod?.nombre || s.producto}` })}
                                        className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex-shrink-0 shadow-sm cursor-pointer group/img"
                                        title="Clic para ampliar foto"
                                      >
                                        <img
                                          src={imgUrl}
                                          alt={String(s.producto)}
                                          className="w-full h-full object-cover group-hover/img:scale-105 transition"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                                          <Maximize2 size={12} className="text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0">
                                        <Package size={22} />
                                      </div>
                                    )}

                                    {/* Miniatura Guía de Tallas */}
                                    {imgGuiaUrl && (
                                      <div
                                        onClick={() => setLightboxImage({ url: imgGuiaUrl, title: `Guía de Medidas: ${prod?.nombre || s.producto}` })}
                                        className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-cyan-500/40 bg-slate-950 flex-shrink-0 shadow-sm cursor-pointer group/guia"
                                        title="Clic para ver Guía de Medidas ampliada"
                                      >
                                        <img
                                          src={imgGuiaUrl}
                                          alt="Guía de tallas"
                                          className="w-full h-full object-cover group-hover/guia:scale-105 transition"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute bottom-0 inset-x-0 bg-cyan-950/90 text-[8px] font-bold text-cyan-300 text-center py-0.5">
                                          GUÍA
                                        </div>
                                        <div className="absolute inset-0 bg-cyan-900/40 opacity-0 group-hover/guia:opacity-100 flex items-center justify-center transition">
                                          <Maximize2 size={12} className="text-cyan-200" />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Info básica y badges */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="font-bold text-slate-100 text-xs sm:text-sm truncate" title={prod?.nombre || String(s.producto)}>
                                        {prod?.nombre || s.producto}
                                      </h4>
                                      <span className="text-[10px] text-slate-500 font-mono">#{s.id}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                      <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-mono font-bold rounded-md text-[11px]" title="Talla del producto">
                                        {tallaMostrada}
                                      </span>
                                      <UbicacionBadge posicion={prod?.posicion || s.ubicacion} fila={prod?.fila} />
                                      <span
                                        className={`px-2 py-0.5 rounded-md border font-mono font-semibold text-[11px] ${
                                          s.cantidad > 0
                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                            : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                                        }`}
                                        title="Stock disponible"
                                      >
                                        {s.cantidad} {s.cantidad === 1 ? 'ud' : 'uds'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* COLUMNA DERECHA: SUB-GRID DE INPUTS Y ACCIONES */}
                                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3 items-center">
                                  {/* 1. COSTO UNITARIO */}
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <label className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block truncate">
                                      Costo Unit.
                                    </label>
                                    <div className="relative flex items-center w-full">
                                      <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-500">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={edit?.precio_recibido !== undefined ? edit.precio_recibido : costoUnit}
                                        onChange={(e) => handleCambioPrecioRecibido(s.id, e.target.value, margenValorNum)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleGuardarPrecioMargen(s);
                                          } else if (e.key === 'Escape') {
                                            handleCancelarEdicion(s.id);
                                          }
                                        }}
                                        className={`w-full bg-slate-950 border rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-bold transition focus:outline-none ${
                                          edit?.dirty && edit?.precio_recibido !== undefined
                                            ? 'border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                                            : 'border-slate-800 text-amber-400 hover:border-slate-700'
                                        }`}
                                        title="Modificar precio recibido / costo (Enter para guardar)"
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono truncate">
                                      {edit?.dirty && edit?.precio_recibido !== undefined ? (
                                        <span className="text-amber-400/90">Modificado</span>
                                      ) : (
                                        'Costo base'
                                      )}
                                    </span>
                                  </div>

                                  {/* 2. PRECIO DE VENTA */}
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <label className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block truncate">
                                      Precio Venta
                                    </label>
                                    <div className="relative flex items-center w-full">
                                      <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-500">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={edit ? edit.precio_comercial : ventaUnitNum}
                                        onChange={(e) => handleCambioPrecioComercial(s.id, costoUnit, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleGuardarPrecioMargen(s);
                                          } else if (e.key === 'Escape') {
                                            handleCancelarEdicion(s.id);
                                          }
                                        }}
                                        className={`w-full bg-slate-950 border rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-bold transition focus:outline-none ${
                                          edit?.dirty
                                            ? 'border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                                            : 'border-slate-800 text-emerald-400 hover:border-slate-700'
                                        }`}
                                        title="Modificar precio de venta comercial (Enter para guardar)"
                                      />
                                    </div>
                                    {edit?.dirty ? (
                                      <div className="flex items-center gap-1 animate-fadeIn">
                                        <button
                                          type="button"
                                          onClick={() => handleGuardarPrecioMargen(s)}
                                          disabled={edit.saving}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                                          title="Guardar precio y margen"
                                        >
                                          <Check size={11} /> {edit.saving ? '...' : 'Guardar'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCancelarEdicion(s.id)}
                                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-[10px] transition cursor-pointer"
                                          title="Deshacer cambios"
                                        >
                                          <X size={11} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 font-mono truncate">
                                        PVP comercial
                                      </span>
                                    )}
                                  </div>

                                  {/* 3. % MARGEN Y GANANCIA */}
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <label className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block truncate">
                                        % Margen
                                      </label>
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border whitespace-nowrap ${
                                        margenValorNum >= 0
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                      }`}>
                                        {margenValorNum >= 0 ? `+${margenValorNum}%` : `${margenValorNum}%`}
                                      </span>
                                    </div>
                                    <div className="relative flex items-center w-full">
                                      <span className="absolute left-2.5 text-[10px] font-mono font-bold text-slate-500">%</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={edit ? edit.porcentaje_margen : margenValorNum}
                                        onChange={(e) => handleCambioMargen(s.id, costoUnit, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleGuardarPrecioMargen(s);
                                          } else if (e.key === 'Escape') {
                                            handleCancelarEdicion(s.id);
                                          }
                                        }}
                                        className={`w-full bg-slate-950 border rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-bold transition focus:outline-none ${
                                          edit?.dirty
                                            ? 'border-indigo-500 text-indigo-300 ring-2 ring-indigo-500/30'
                                            : 'border-slate-800 text-indigo-300 hover:border-slate-700'
                                        }`}
                                        title="Modificar % margen comercial (Enter para guardar)"
                                      />
                                    </div>
                                    <div className="text-[10px] font-mono flex items-center gap-1 text-slate-400 truncate">
                                      <span className="text-slate-500">Gan:</span>
                                      <span className={gananciaUnitaria >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                        {gananciaUnitaria >= 0 ? `+$${gananciaUnitaria.toLocaleString()}` : `-$${Math.abs(gananciaUnitaria).toLocaleString()}`}
                                      </span>
                                      <span className="text-[9px] text-slate-600">/ud</span>
                                    </div>
                                  </div>

                                  {/* 4. AJUSTE RÁPIDO (+ / -) Y ACCIONES */}
                                  <div className="flex flex-col gap-1.5 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <label className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block truncate">
                                        Ajuste / Stock
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(s.id)}
                                        className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                        title="Eliminar este registro de stock"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1.5 w-full">
                                      {/* Selector Rápido + / - */}
                                      <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-sm shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleIniciarAjuste(s, 'quitar')}
                                          disabled={s.cantidad <= 0}
                                          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition text-xs font-bold active:scale-95 cursor-pointer"
                                          title="Disminuir 1 unidad (-1)"
                                        >
                                          -
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleIniciarAjuste(s, 'agregar')}
                                          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-bold active:scale-95 cursor-pointer"
                                          title="Aumentar 1 unidad (+1)"
                                        >
                                          +
                                        </button>
                                      </div>

                                      {/* Botón Registrar Venta */}
                                      <button
                                        type="button"
                                        onClick={() => handleAbrirModalVenta(s)}
                                        disabled={s.cantidad <= 0}
                                        className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap"
                                        title="Registrar Venta"
                                      >
                                        <ShoppingCart size={13} className="shrink-0" />
                                        <span>Vender</span>
                                      </button>
                                    </div>

                                    {s.cantidad > 0 ? (
                                      <span className="text-[10px] text-slate-500 font-mono text-center truncate">
                                        Tot Gan: <strong className="text-slate-300">${gananciaTotal.toLocaleString()}</strong>
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-rose-400 font-mono text-center truncate">
                                        Agotado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                  {/* CONTROLES DE PAGINACIÓN DE LA CATEGORÍA (ESTRICTAMENTE 6 PRODUCTOS POR PÁGINA) */}
                  {items.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 border-t border-slate-800 p-3 sm:p-3.5 px-3 sm:px-4">
                      <div className="text-xs text-slate-400 font-medium text-center sm:text-left">
                        Mostrando <span className="font-bold text-slate-200">{(paginaCat - 1) * ITEMS_PER_PAGE + 1}</span> al{' '}
                        <span className="font-bold text-slate-200">
                          {Math.min(paginaCat * ITEMS_PER_PAGE, items.length)}
                        </span>{' '}
                        de <span className="font-bold text-indigo-400">{items.length}</span> en {categoriaNombre}
                        <span className="text-slate-600 mx-2 hidden sm:inline">|</span>
                        <span className="block sm:inline mt-0.5 sm:mt-0">
                          Pág. <span className="font-bold text-slate-200">{paginaCat}</span> de{' '}
                          <span className="font-bold text-slate-200">{totalPaginasCat}</span>
                        </span>
                      </div>

                      {totalPaginasCat > 1 && (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPaginaPorCategoria((prev) => ({ ...prev, [categoriaNombre]: 1 }))}
                            disabled={paginaCat === 1}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                            title="Primera página"
                          >
                            <ChevronsLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaginaPorCategoria((prev) => ({ ...prev, [categoriaNombre]: Math.max(1, paginaCat - 1) }))}
                            disabled={paginaCat === 1}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                            title="Página anterior"
                          >
                            <ChevronLeft size={14} />
                          </button>

                          <div className="flex items-center gap-1 px-1">
                            {Array.from({ length: totalPaginasCat }, (_, i) => i + 1).map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setPaginaPorCategoria((prev) => ({ ...prev, [categoriaNombre]: num }))}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  paginaCat === num
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setPaginaPorCategoria((prev) => ({ ...prev, [categoriaNombre]: Math.min(totalPaginasCat, paginaCat + 1) }))}
                            disabled={paginaCat === totalPaginasCat}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                            title="Página siguiente"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaginaPorCategoria((prev) => ({ ...prev, [categoriaNombre]: totalPaginasCat }))}
                            disabled={paginaCat === totalPaginasCat}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                            title="Última página"
                          >
                            <ChevronsRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE REGISTRO DE VENTA RÁPIDA (POS) */}
      {stockParaVenta && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <ShoppingCart size={20} className="text-emerald-400 shrink-0" /> <span>Registrar Venta (POS)</span>
              </h3>
              <button
                onClick={() => setStockParaVenta(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* RESUMEN DEL PRODUCTO A VENDER */}
            <div className="p-3 sm:p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
              {formatearUrlImagen(
                productos.find((p) => p.id === stockParaVenta.producto_id || String(p.id) === String(stockParaVenta.producto) || p.nombre === String(stockParaVenta.producto))?.imagen
              ) ? (
                <img
                  src={formatearUrlImagen(
                    productos.find((p) => p.id === stockParaVenta.producto_id || String(p.id) === String(stockParaVenta.producto) || p.nombre === String(stockParaVenta.producto))?.imagen
                  )!}
                  alt={String(stockParaVenta.producto)}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <Package size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{String(stockParaVenta.producto)}</h4>
                <div className="text-[11px] sm:text-xs text-slate-400 flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 sm:px-2 py-0.5 rounded font-mono">
                    Talla: {stockParaVenta.talla || productos.find(p => p.id === stockParaVenta.producto_id)?.talla || 'Sin talla'}
                  </span>
                  <span className="text-slate-400">• Disp: <strong className="text-emerald-400">{stockParaVenta.cantidad}</strong> uds</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirmarVenta} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Cantidad a Vender (Máx: {stockParaVenta.cantidad})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={stockParaVenta.cantidad}
                    required
                    value={cantidadVenta}
                    onChange={(e) => setCantidadVenta(Math.max(1, Math.min(stockParaVenta.cantidad, Number(e.target.value) || 1)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 sm:px-4 py-2 text-slate-100 text-base sm:text-lg font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {[1, 2, 5].map((preset) => (
                      preset <= stockParaVenta.cantidad && (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCantidadVenta(preset)}
                          className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-xs font-mono font-semibold text-slate-300 rounded-xl transition cursor-pointer"
                        >
                          +{preset}
                        </button>
                      )
                    ))}
                    <button
                      type="button"
                      onClick={() => setCantidadVenta(stockParaVenta.cantidad)}
                      className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-xs font-mono font-semibold text-indigo-400 rounded-xl transition cursor-pointer"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>

              {/* DATOS DEL CLIENTE Y ENVÍO */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nombre del Cliente</label>
                  <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombre completo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Teléfono</label>
                  <input value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} placeholder="3001234567" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Ciudad</label>
                  <input value={clienteCiudad} onChange={(e) => setClienteCiudad(e.target.value)} placeholder="Bogotá" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Dirección</label>
                  <input value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} placeholder="Calle 123 #45-67" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Barrio</label>
                  <input value={clienteBarrio} onChange={(e) => setClienteBarrio(e.target.value)} placeholder="Chapinero" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">N° de Guía</label>
                  <input value={numeroGuia} onChange={(e) => setNumeroGuia(e.target.value)} placeholder="GUIA-001" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Estado del Envío</label>
                  <select value={estadoEnvio} onChange={(e) => setEstadoEnvio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500">
                    <option value="pendiente">Pendiente</option>
                    <option value="completada">Completada</option>
                    <option value="devolucion">Devolución</option>
                  </select>
                </div>
              </div>

              {/* TOTAL DE LA VENTA */}
              <div className="p-3 sm:p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-300 block">Total a Cobrar</span>
                  <span className="text-[11px] sm:text-xs text-slate-400">
                    {cantidadVenta} uds × ${Number(stockParaVenta.precio_comercial || productos.find(p => p.id === stockParaVenta.producto_id)?.precio_comercial || productos.find(p => p.id === stockParaVenta.producto_id)?.precio || 0).toLocaleString()}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                  ${(
                    cantidadVenta *
                    Number(stockParaVenta.precio_comercial || productos.find(p => p.id === stockParaVenta.producto_id)?.precio_comercial || productos.find(p => p.id === stockParaVenta.producto_id)?.precio || 0)
                  ).toLocaleString()}
                </div>
              </div>

              {/* DESGLOSE DE GANANCIA NETA EN POS */}
              {(() => {
                const prodVenta = productos.find(p => p.id === stockParaVenta.producto_id || String(p.id) === String(stockParaVenta.producto) || p.nombre === String(stockParaVenta.producto));
                const costoVentaUnit = Number(stockParaVenta.precio_recibido || prodVenta?.precio_recibido || 0);
                const precioVentaUnit = Number(stockParaVenta.precio_comercial || prodVenta?.precio_comercial || prodVenta?.precio || 0);
                const margenVenta = Number(stockParaVenta.porcentaje_margen ?? 75);
                const gananciaUnitariaVenta = precioVentaUnit - costoVentaUnit;
                const gananciaVentaTotal = gananciaUnitariaVenta * cantidadVenta;

                return (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 bg-slate-950 p-3 sm:p-3.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] sm:text-[11px] mb-0.5">Margen Comercial</span>
                      <span className="font-mono font-bold text-indigo-300 flex items-center gap-1 text-[11px] sm:text-xs">
                        <TrendingUp size={13} className="shrink-0" /> +{margenVenta}% ganancia
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] sm:text-[11px] mb-0.5">Ganancia Neta</span>
                      <span className="font-mono font-bold text-emerald-400 text-[11px] sm:text-xs">
                        {gananciaVentaTotal >= 0 ? `+$${gananciaVentaTotal.toLocaleString()}` : `-$${Math.abs(gananciaVentaTotal).toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStockParaVenta(null)}
                  className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl font-medium transition cursor-pointer text-xs sm:text-sm text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoVenta}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer text-xs sm:text-sm"
                >
                  <DollarSign size={18} /> {procesandoVenta ? 'Procesando...' : 'Confirmar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE AJUSTE RÁPIDO (AGREGAR / QUITAR) */}
      {confirmacionAjuste && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md mx-auto p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 sm:gap-2.5">
                {confirmacionAjuste.tipo === 'agregar' ? (
                  <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <PlusCircle size={20} />
                  </div>
                ) : (
                  <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-100">
                    {confirmacionAjuste.tipo === 'agregar' ? 'Confirmar Aumento de Stock' : 'Confirmar Reducción de Stock'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Ajuste rápido de inventario</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmacionAjuste(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* DETALLE DEL PRODUCTO */}
            <div className="bg-slate-950 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
              {formatearUrlImagen(
                productos.find(p => p.id === confirmacionAjuste.stock.producto_id || String(p.id) === String(confirmacionAjuste.stock.producto) || p.nombre === String(confirmacionAjuste.stock.producto))?.imagen
              ) ? (
                <img
                  src={formatearUrlImagen(
                    productos.find(p => p.id === confirmacionAjuste.stock.producto_id || String(p.id) === String(confirmacionAjuste.stock.producto) || p.nombre === String(confirmacionAjuste.stock.producto))?.imagen
                  )!}
                  alt={confirmacionAjuste.productoNombre}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <Package size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{confirmacionAjuste.productoNombre}</h4>
                <div className="text-[11px] sm:text-xs text-slate-400 flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono">
                    Talla: {confirmacionAjuste.stock.talla || 'Sin talla'}
                  </span>
                  <span className="text-slate-500">• Actual: <strong className="text-slate-200">{confirmacionAjuste.stock.cantidad}</strong> uds</span>
                </div>
              </div>
            </div>

            {/* MENSAJE EXPLICATIVO VISUAL */}
            <div className={`p-3.5 sm:p-4 rounded-xl border ${
              confirmacionAjuste.tipo === 'agregar'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
            }`}>
              <p className="text-xs sm:text-sm leading-relaxed">
                {confirmacionAjuste.tipo === 'agregar' ? (
                  <>
                    ¿Deseas <strong>AGREGAR</strong>{' '}
                    <span className="font-bold underline decoration-emerald-400 font-mono text-emerald-300">
                      +{confirmacionAjuste.cantidadAjuste} unidad(es)
                    </span>{' '}
                    al stock disponible de <strong>{confirmacionAjuste.productoNombre}</strong>?
                  </>
                ) : (
                  <>
                    ¿Deseas <strong>SUSTRAER / QUITAR</strong>{' '}
                    <span className="font-bold underline decoration-amber-400 font-mono text-amber-300">
                      -{confirmacionAjuste.cantidadAjuste} unidad(es)
                    </span>{' '}
                    del stock disponible de <strong>{confirmacionAjuste.productoNombre}</strong>?
                  </>
                )}
              </p>

              {/* COMPARATIVA STOCK */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Actual: <strong className="text-slate-200">{confirmacionAjuste.stock.cantidad} uds</strong></span>
                <ArrowRight size={14} className="text-slate-500" />
                <span>
                  Nuevo:{' '}
                  <strong className={confirmacionAjuste.tipo === 'agregar' ? 'text-emerald-400 text-xs sm:text-sm font-bold' : 'text-amber-400 text-xs sm:text-sm font-bold'}>
                    {confirmacionAjuste.tipo === 'agregar'
                      ? confirmacionAjuste.stock.cantidad + confirmacionAjuste.cantidadAjuste
                      : Math.max(0, confirmacionAjuste.stock.cantidad - confirmacionAjuste.cantidadAjuste)} uds
                  </strong>
                </span>
              </div>
            </div>

            {/* ADVERTENCIA SI QUITA STOCK Y ESTÁ EN CERO */}
            {confirmacionAjuste.tipo === 'quitar' && confirmacionAjuste.stock.cantidad <= 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>No se pueden sustraer unidades porque el stock actual ya es 0.</span>
              </div>
            )}

            {/* BOTONES DE ACCIÓN */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmacionAjuste(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl font-medium transition cursor-pointer text-xs sm:text-sm text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEjecutarAjusteConfirmado}
                disabled={procesandoAjuste || (confirmacionAjuste.tipo === 'quitar' && confirmacionAjuste.stock.cantidad <= 0)}
                className={`w-full sm:w-auto px-5 py-2.5 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 cursor-pointer text-xs sm:text-sm ${
                  confirmacionAjuste.tipo === 'agregar'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                }`}
              >
                {procesandoAjuste
                  ? 'Actualizando...'
                  : confirmacionAjuste.tipo === 'agregar'
                  ? `Confirmar y Agregar (+${confirmacionAjuste.cantidadAjuste})`
                  : `Confirmar y Quitar (-${confirmacionAjuste.cantidadAjuste})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / LIGHTBOX PARA VER IMAGEN O GUÍA DE TALLAS AMPLIADA */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 cursor-zoom-out animate-fadeIn overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-3 sm:p-4 flex flex-col items-center cursor-default"
          >
            <div className="w-full flex items-center justify-between pb-2.5 sm:pb-3 mb-2 border-b border-slate-800">
              <h4 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2 truncate pr-2">
                <Shirt size={16} className="text-cyan-400 shrink-0" /> <span className="truncate">{lightboxImage.title}</span>
              </h4>
              <button
                onClick={() => setLightboxImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-h-[70vh] sm:max-h-[75vh] w-auto max-w-full object-contain rounded-xl border border-slate-800 shadow-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
