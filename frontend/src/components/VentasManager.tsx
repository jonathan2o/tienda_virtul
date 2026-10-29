import { useState, useEffect, useMemo } from 'react';
import { stockService } from '../services/stockService';
import { usuarioService, type UsuarioItem } from '../services/usuarioService';
import { getAuth } from '../services/authService';
import type { Producto, Stock, Categoria, Venta } from '../types';
import {
  ReceiptText,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  Edit3,
  X,
  Filter,
  User,
  Phone,
  MapPin,
  Building,
  Hash,
  RefreshCw,
  ShoppingBag,
  Layers
} from 'lucide-react';

interface CartItem {
  stockId: number;
  productoId: number;
  productoNombre: string;
  imagen: string | null;
  talla: string;
  precioComercial: number;
  cantidad: number;
  stockDisponible: number;
}

export const VentasManager = () => {
  const auth = getAuth();
  const esWorker = auth?.rol === 'worker';

  // Modo de vista:
  // - Por defecto 'catalogo' (catálogo + carrito) para que siempre sea lo primero visible al entrar a Ventas
  const [vistaActiva, setVistaActiva] = useState<'catalogo' | 'seguimiento' | 'reporte'>('catalogo');

  // Estados de datos principales
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [trabajadores, setTrabajadores] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Catálogo
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [tallaSeleccionadaPorProducto, setTallaSeleccionadaPorProducto] = useState<{ [productoId: number]: number }>({});

  // Carrito de ventas
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [drawerCarritoAbierto, setDrawerCarritoAbierto] = useState(false);
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  // Formulario de despacho / cliente para venta
  const [datosDespacho, setDatosDespacho] = useState({
    nombre_cliente: '',
    telefono_cliente: '',
    direccion: '',
    barrio: '',
    ciudad: '',
    numero_guia: '',
  });

  // Filtros de Reporte / Seguimiento
  const [filtroTrabajador, setFiltroTrabajador] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroGuia, setFiltroGuia] = useState<'todas' | 'sin_guia' | 'con_guia'>('todas');
  const [busquedaVenta, setBusquedaVenta] = useState('');

  // Modal para modificar venta (guía, cliente, estado)
  const [ventaAEditar, setVentaAEditar] = useState<Venta | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [datosEdicion, setDatosEdicion] = useState({
    numero_guia: '',
    nombre_cliente: '',
    telefono_cliente: '',
    direccion: '',
    barrio: '',
    ciudad: '',
    estado: 'pendiente',
  });

  // Notificación flotante
  const [mensajeToast, setMensajeToast] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const mostrarToast = (texto: string, tipo: 'success' | 'error' = 'success') => {
    setMensajeToast({ tipo, texto });
    setTimeout(() => setMensajeToast(null), 4500);
  };

  const formatearUrlImagen = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [prods, stks, cats, vnts] = await Promise.all([
        stockService.getProductos(),
        stockService.getStocks(),
        stockService.getCategorias(),
        stockService.getVentas(),
      ]);
      setProductos(prods);
      setStocks(stks);
      setCategorias(cats);
      setVentas(vnts);

      if (!esWorker) {
        try {
          const trabs = await usuarioService.getTrabajadores();
          setTrabajadores(trabs);
        } catch (e) {
          console.error('Error al cargar lista de trabajadores:', e);
        }
      }
    } catch (err) {
      console.error('Error al cargar datos de ventas:', err);
      mostrarToast('Error al cargar información del servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Mapeo de stocks por producto
  const stocksPorProducto = useMemo(() => {
    const mapa: { [productoId: number]: Stock[] } = {};
    stocks.forEach((stk) => {
      const prodId = Number(stk.producto_id || stk.producto);
      if (!mapa[prodId]) mapa[prodId] = [];
      mapa[prodId].push(stk);
    });
    return mapa;
  }, [stocks]);

  // Filtrado de productos en catálogo
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const cumpleCategoria =
        categoriaSeleccionada === 'todas' ||
        String(p.categoria?.id || p.categoria_id) === String(categoriaSeleccionada);
      const cumpleBusqueda =
        !busquedaProducto.trim() ||
        p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(busquedaProducto.toLowerCase()));
      return cumpleCategoria && cumpleBusqueda;
    });
  }, [productos, categoriaSeleccionada, busquedaProducto]);

  // Manejo de Carrito
  const agregarAlCarrito = (producto: Producto, stockSeleccionado: Stock) => {
    const disponible = Number(stockSeleccionado.cantidad || 0);
    if (disponible <= 0) {
      mostrarToast('Esta talla no tiene stock disponible.', 'error');
      return;
    }

    const itemExistente = carrito.find((i) => i.stockId === stockSeleccionado.id);
    if (itemExistente) {
      if (itemExistente.cantidad >= disponible) {
        mostrarToast(`Stock máximo alcanzado para esta talla (${disponible} uds).`, 'error');
        return;
      }
      setCarrito(
        carrito.map((i) =>
          i.stockId === stockSeleccionado.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      );
    } else {
      const precioComercial = Number(
        stockSeleccionado.precio_comercial ||
        producto.precio_comercial ||
        producto.precio ||
        0
      );
      setCarrito([
        ...carrito,
        {
          stockId: stockSeleccionado.id,
          productoId: producto.id,
          productoNombre: producto.nombre,
          imagen: producto.imagen || null,
          talla: stockSeleccionado.talla || producto.talla || 'Única',
          precioComercial,
          cantidad: 1,
          stockDisponible: disponible,
        },
      ]);
    }
    mostrarToast(`Agregado al carrito: ${producto.nombre} (Talla ${stockSeleccionado.talla || 'Única'})`);
  };

  const modificarCantidadCarrito = (stockId: number, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.stockId !== stockId) return item;
          const nuevaCantidad = item.cantidad + delta;
          if (nuevaCantidad <= 0) return null;
          if (nuevaCantidad > item.stockDisponible) {
            mostrarToast(`No puedes superar el stock disponible (${item.stockDisponible} uds).`, 'error');
            return item;
          }
          return { ...item, cantidad: nuevaCantidad };
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const eliminarDelCarrito = (stockId: number) => {
    setCarrito(carrito.filter((i) => i.stockId !== stockId));
  };

  const totalCarrito = useMemo(() => {
    return carrito.reduce((acc, item) => acc + item.precioComercial * item.cantidad, 0);
  }, [carrito]);

  const totalPrendasCarrito = useMemo(() => {
    return carrito.reduce((acc, item) => acc + item.cantidad, 0);
  }, [carrito]);

  // Procesar venta del carrito
  const handleConfirmarVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carrito.length === 0) {
      mostrarToast('El carrito está vacío.', 'error');
      return;
    }

    setProcesandoVenta(true);
    try {
      // Registrar cada ítem en la base de datos
      const promesas = carrito.map((item) =>
        stockService.registrarVenta({
          stock_id: item.stockId,
          cantidad_vendida: item.cantidad,
          nombre_cliente: datosDespacho.nombre_cliente.trim(),
          telefono_cliente: datosDespacho.telefono_cliente.trim(),
          direccion: datosDespacho.direccion.trim(),
          barrio: datosDespacho.barrio.trim(),
          ciudad: datosDespacho.ciudad.trim(),
          numero_guia: datosDespacho.numero_guia.trim(),
          estado: 'pendiente',
        })
      );

      await Promise.all(promesas);

      mostrarToast(
        `¡Venta registrada con éxito! ${totalPrendasCarrito} prenda(s) procesadas por un total de $${totalCarrito.toLocaleString()}.`,
        'success'
      );

      // Limpiar carrito y formulario
      setCarrito([]);
      setDatosDespacho({
        nombre_cliente: '',
        telefono_cliente: '',
        direccion: '',
        barrio: '',
        ciudad: '',
        numero_guia: '',
      });
      setDrawerCarritoAbierto(false);

      // Recargar datos actualizados (stock descontado y ventas nuevas)
      await cargarDatos();
    } catch (err: any) {
      console.error('Error al procesar la venta:', err);
      const detalleError = err?.response?.data?.detail || err?.response?.data?.cantidad_vendida || 'Ocurrió un error al procesar la venta.';
      mostrarToast(String(detalleError), 'error');
    } finally {
      setProcesandoVenta(false);
    }
  };

  // Abrir modal de edición de venta
  const handleAbrirEdicionVenta = (venta: Venta) => {
    setVentaAEditar(venta);
    setDatosEdicion({
      numero_guia: venta.numero_guia || '',
      nombre_cliente: venta.nombre_cliente || '',
      telefono_cliente: venta.telefono_cliente || '',
      direccion: venta.direccion || '',
      barrio: venta.barrio || '',
      ciudad: venta.ciudad || '',
      estado: venta.estado || 'pendiente',
    });
  };

  // Guardar edición de venta
  const handleGuardarEdicionVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ventaAEditar) return;

    setGuardandoEdicion(true);
    try {
      const payload: Partial<Venta> = {
        numero_guia: datosEdicion.numero_guia.trim(),
        nombre_cliente: datosEdicion.nombre_cliente.trim(),
        telefono_cliente: datosEdicion.telefono_cliente.trim(),
        direccion: datosEdicion.direccion.trim(),
        barrio: datosEdicion.barrio.trim(),
        ciudad: datosEdicion.ciudad.trim(),
      };

      if (!esWorker) {
        payload.estado = datosEdicion.estado;
      }

      const ventaActualizada = await stockService.actualizarVenta(ventaAEditar.id, payload);
      setVentas(ventas.map((v) => (v.id === ventaActualizada.id ? ventaActualizada : v)));
      mostrarToast('Venta actualizada correctamente.');
      setVentaAEditar(null);
    } catch (err: any) {
      console.error('Error al actualizar venta:', err);
      const msg = err?.response?.data?.detalle || err?.response?.data?.detail || 'No se pudo actualizar la venta.';
      mostrarToast(String(msg), 'error');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Eliminar venta (solo admin)
  const handleEliminarVenta = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar esta venta? El registro se borrará permanentemente.')) {
      return;
    }
    try {
      await stockService.eliminarVenta(id);
      setVentas(ventas.filter((v) => v.id !== id));
      mostrarToast('Venta eliminada correctamente.');
    } catch (err: any) {
      console.error('Error al eliminar venta:', err);
      mostrarToast('No se pudo eliminar la venta.', 'error');
    }
  };

  // Filtrado de Ventas para Reporte / Seguimiento
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      // Filtro de trabajador (admin)
      if (filtroTrabajador !== 'todos') {
        const matchUser = String(v.usuario) === filtroTrabajador || v.usuario_nombre === filtroTrabajador;
        if (!matchUser) return false;
      }

      // Filtro de estado
      if (filtroEstado !== 'todos') {
        if (v.estado !== filtroEstado) return false;
      }

      // Filtro de guía
      if (filtroGuia === 'sin_guia') {
        if (v.numero_guia && v.numero_guia.trim() !== '') return false;
      } else if (filtroGuia === 'con_guia') {
        if (!v.numero_guia || v.numero_guia.trim() === '') return false;
      }

      // Buscador
      if (busquedaVenta.trim()) {
        const q = busquedaVenta.toLowerCase();
        const coincideCliente = v.nombre_cliente?.toLowerCase().includes(q);
        const coincideTel = v.telefono_cliente?.toLowerCase().includes(q);
        const coincideGuia = v.numero_guia?.toLowerCase().includes(q);
        const coincideProd = v.producto_nombre?.toLowerCase().includes(q);
        const coincideCiudad = v.ciudad?.toLowerCase().includes(q);
        if (!coincideCliente && !coincideTel && !coincideGuia && !coincideProd && !coincideCiudad) {
          return false;
        }
      }

      return true;
    });
  }, [ventas, filtroTrabajador, filtroEstado, filtroGuia, busquedaVenta]);

  // Métricas del reporte
  const totalMontoVentas = useMemo(() => {
    return ventasFiltradas.reduce((acc, v) => acc + Number(v.total_venta || 0), 0);
  }, [ventasFiltradas]);

  const totalUnidadesVentas = useMemo(() => {
    return ventasFiltradas.reduce((acc, v) => acc + Number(v.cantidad_vendida || v.cantidad || 0), 0);
  }, [ventasFiltradas]);

  const totalSinGuia = useMemo(() => {
    return ventasFiltradas.filter((v) => !v.numero_guia || v.numero_guia.trim() === '').length;
  }, [ventasFiltradas]);

  const totalCompletadas = useMemo(() => {
    return ventasFiltradas.filter((v) => v.estado === 'completada').length;
  }, [ventasFiltradas]);

  return (
    <div className="space-y-6 pb-20">
      {/* TOAST FLOTANTE */}
      {mensajeToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-fadeIn text-sm font-medium ${
            mensajeToast.tipo === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {mensajeToast.tipo === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
          )}
          <span>{mensajeToast.texto}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL CON ALTERNANCIA DE VISTAS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <ReceiptText size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                {esWorker ? 'Punto de Venta & Catálogo' : 'Gestión y Reporte de Ventas'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {esWorker
                  ? 'Selecciona productos, añade al carrito y procesa tus ventas con seguimiento de guías.'
                  : 'Monitorea las ventas de los trabajadores, asigna guías de despacho y gestiona estados.'}
              </p>
            </div>
          </div>
        </div>

        {/* PESTAÑAS DE VISTA */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 shrink-0">
          {esWorker ? (
            <>
              <button
                type="button"
                onClick={() => setVistaActiva('catalogo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  vistaActiva === 'catalogo'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingBag size={14} /> Catálogo de Venta
              </button>
              <button
                type="button"
                onClick={() => setVistaActiva('seguimiento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  vistaActiva === 'seguimiento'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck size={14} /> Mis Ventas & Guías
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setVistaActiva('catalogo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  vistaActiva === 'catalogo'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingBag size={14} /> Catálogo & Venta (POS)
              </button>
              <button
                type="button"
                onClick={() => setVistaActiva('reporte')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  vistaActiva === 'reporte'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers size={14} /> Reporte de Trabajadores
              </button>
            </>
          )}

          <button
            type="button"
            onClick={cargarDatos}
            title="Recargar datos"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: CATÁLOGO DE PRODUCTOS LIMPIO CON CARRITO (TRABAJADOR / NUEVA VENTA) */}
      {/* ========================================================================= */}
      {vistaActiva === 'catalogo' && (
        <div className="space-y-6">
          {/* BARRA DE FILTROS Y CATEGORÍAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* BUSCADOR */}
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* BOTÓN FLOTANTE O ACCESO DIRECTO AL CARRITO */}
              <button
                type="button"
                onClick={() => setDrawerCarritoAbierto(true)}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                <ShoppingCart size={16} />
                <span>Ver Carrito</span>
                {totalPrendasCarrito > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-white text-indigo-700 text-xs font-bold">
                    {totalPrendasCarrito}
                  </span>
                )}
                {totalCarrito > 0 && (
                  <span className="text-indigo-200 font-mono text-xs">
                    (${totalCarrito.toLocaleString()})
                  </span>
                )}
              </button>
            </div>

            {/* CHIPS DE CATEGORÍAS */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Filter size={12} /> Categorías:
              </p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setCategoriaSeleccionada('todas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    categoriaSeleccionada === 'todas'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  Todas ({productos.length})
                </button>
                {categorias.map((cat) => {
                  const cant = productos.filter((p) => String(p.categoria?.id || p.categoria_id) === String(cat.id)).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoriaSeleccionada(String(cat.id))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        categoriaSeleccionada === String(cat.id)
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {cat.nombre} ({cant})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* GRID LIMPIO DE PRODUCTOS */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw size={28} className="animate-spin mx-auto text-indigo-400" />
              <p className="text-sm">Cargando catálogo de productos...</p>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <ShoppingBag size={36} className="mx-auto text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No se encontraron productos</h3>
              <p className="text-xs text-slate-500 mt-1">Prueba con otra búsqueda o selecciona otra categoría.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {productosFiltrados.map((prod) => {
                const stocksDelProd = stocksPorProducto[prod.id] || [];
                const imgUrl = formatearUrlImagen(prod.imagen);

                // Stock total acumulado
                const totalDisp = stocksDelProd.reduce((acc, s) => acc + Number(s.cantidad || 0), 0);

                // Determinar el stock seleccionado en el producto
                const stockSeleccionadoId =
                  tallaSeleccionadaPorProducto[prod.id] ||
                  (stocksDelProd.find((s) => Number(s.cantidad || 0) > 0)?.id ?? stocksDelProd[0]?.id);

                const stockActual = stocksDelProd.find((s) => s.id === stockSeleccionadoId);
                const precioVenta = Number(
                  stockActual?.precio_comercial ||
                  prod.precio_comercial ||
                  prod.precio ||
                  0
                );

                const tieneDisponibilidad = totalDisp > 0;

                return (
                  <div
                    key={prod.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-slate-700 transition group"
                  >
                    <div>
                      {/* FOTO DEL PRODUCTO */}
                      <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={prod.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-slate-600 flex flex-col items-center gap-1">
                            <ShoppingBag size={36} />
                            <span className="text-[10px] text-slate-500 font-medium">Sin imagen</span>
                          </div>
                        )}

                        {/* BADGE DE PRECIO COMERCIAL */}
                        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-emerald-400 text-xs sm:text-sm font-bold shadow-lg">
                          ${precioVenta.toLocaleString()}
                        </div>

                        {/* BADGE DE CATEGORÍA */}
                        {prod.categoria && (
                          <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-medium text-slate-300 border border-white/10">
                            {prod.categoria.nombre}
                          </div>
                        )}
                      </div>

                      {/* INFORMACIÓN DEL PRODUCTO */}
                      <div className="p-3.5 sm:p-4 space-y-3">
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-slate-100 line-clamp-1" title={prod.nombre}>
                            {prod.nombre}
                          </h3>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                            <span>Precio Venta: <strong className="text-emerald-400 font-semibold">${precioVenta.toLocaleString()}</strong></span>
                            <span>Total Disp: <strong className={tieneDisponibilidad ? 'text-indigo-400' : 'text-rose-400'}>{totalDisp} uds</strong></span>
                          </div>
                        </div>

                        {/* SELECTOR DE TALLAS (EN ROJO SI NO HAY DISPONIBLES) */}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Tallas disponibles:
                          </p>

                          {stocksDelProd.length === 0 ? (
                            <div className="text-[11px] text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">
                              Sin registros de stock
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {stocksDelProd.map((stk) => {
                                const cant = Number(stk.cantidad || 0);
                                const isAgotado = cant <= 0;
                                const isSelected = stk.id === stockActual?.id;
                                const tallaTexto = stk.talla || prod.talla || 'Única';

                                return (
                                  <button
                                    key={stk.id}
                                    type="button"
                                    disabled={isAgotado}
                                    onClick={() =>
                                      setTallaSeleccionadaPorProducto({
                                        ...tallaSeleccionadaPorProducto,
                                        [prod.id]: stk.id,
                                      })
                                    }
                                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                                      isAgotado
                                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400 opacity-80 cursor-not-allowed'
                                        : isSelected
                                        ? 'bg-indigo-600 text-white border border-indigo-500 shadow-md shadow-indigo-600/30'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700/60 hover:border-slate-500 hover:text-white'
                                    }`}
                                    title={isAgotado ? `Talla ${tallaTexto} agotada (0 disponibles)` : `Talla ${tallaTexto}: ${cant} unidades disponibles`}
                                  >
                                    <span>{tallaTexto}</span>
                                    <span className={`text-[9px] px-1 rounded ${isAgotado ? 'bg-rose-500/20 text-rose-300' : isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-900 text-slate-400'}`}>
                                      {isAgotado ? '0' : cant}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BOTÓN PARA AÑADIR AL CARRITO */}
                    <div className="p-3.5 sm:p-4 pt-0">
                      <button
                        type="button"
                        disabled={!stockActual || Number(stockActual.cantidad || 0) <= 0}
                        onClick={() => stockActual && agregarAlCarrito(prod, stockActual)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 ${
                          !stockActual || Number(stockActual.cantidad || 0) <= 0
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 cursor-pointer'
                        }`}
                      >
                        <Plus size={15} />
                        <span>
                          {!stockActual || Number(stockActual.cantidad || 0) <= 0
                            ? 'Agotado'
                            : `Agregar (${stockActual.talla || 'Única'})`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: SEGUIMIENTO DE VENTAS DEL TRABAJADOR O REPORTE DE VENTAS (ADMIN)  */}
      {/* ========================================================================= */}
      {(vistaActiva === 'seguimiento' || vistaActiva === 'reporte') && (
        <div className="space-y-6">
          {/* TARJETAS RESUMEN DE VENTAS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Total Facturado
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-400 block mt-1">
                ${totalMontoVentas.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500">{ventasFiltradas.length} transacciones</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Prendas Vendidas
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-indigo-400 block mt-1">
                {totalUnidadesVentas.toLocaleString()} uds
              </span>
              <span className="text-[11px] text-slate-500">Unidades totales</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-amber-400 block uppercase tracking-wider flex items-center gap-1">
                <Clock size={12} /> Sin Guía Asignada
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-amber-300 block mt-1">
                {totalSinGuia}
              </span>
              <span className="text-[11px] text-slate-500">Pendientes por rotular</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-cyan-400 block uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={12} /> Completadas
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-cyan-300 block mt-1">
                {totalCompletadas}
              </span>
              <span className="text-[11px] text-slate-500">Despachos finalizados</span>
            </div>
          </div>

          {/* BARRA DE FILTROS Y BÚSQUEDA */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* BUSCADOR */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente, guía, teléfono o producto..."
                  value={busquedaVenta}
                  onChange={(e) => setBusquedaVenta(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* FILTRO DE TRABAJADOR (SOLO ADMIN) */}
              {!esWorker && (
                <div>
                  <select
                    value={filtroTrabajador}
                    onChange={(e) => setFiltroTrabajador(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="todos">Todos los Trabajadores</option>
                    {trabajadores.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        Trabajador: {t.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* FILTRO DE ESTADO */}
              <div>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="completada">Completadas</option>
                  <option value="devolucion">Devoluciones</option>
                </select>
              </div>

              {/* FILTRO DE GUÍA */}
              <div>
                <select
                  value={filtroGuia}
                  onChange={(e) => setFiltroGuia(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="todas">Todas las Guías</option>
                  <option value="sin_guia">⚠️ Solo Sin Guía</option>
                  <option value="con_guia">✅ Solo Con Guía</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLA DE VENTAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="p-3">ID / Fecha</th>
                    {!esWorker && <th className="p-3">Trabajador</th>}
                    <th className="p-3">Producto & Talla</th>
                    <th className="p-3">Cant & Total</th>
                    <th className="p-3">Cliente / Teléfono</th>
                    <th className="p-3">Destino (Dirección / Ciudad)</th>
                    <th className="p-3">Número de Guía</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={esWorker ? 8 : 9} className="p-8 text-center text-slate-500">
                        No se encontraron registros de ventas que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    ventasFiltradas.map((v) => {
                      const tieneGuia = Boolean(v.numero_guia && v.numero_guia.trim() !== '');
                      const fFecha = v.fecha_venta
                        ? new Date(v.fecha_venta).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'S/F';

                      return (
                        <tr key={v.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-mono text-indigo-400 font-semibold">#{v.id}</span>
                            <span className="text-[11px] text-slate-400 block">{fFecha}</span>
                          </td>

                          {!esWorker && (
                            <td className="p-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                                <User size={12} className="text-indigo-400" />
                                {v.usuario_nombre || 'N/A'}
                              </span>
                            </td>
                          )}

                          <td className="p-3">
                            <strong className="text-slate-200 block">{v.producto_nombre || 'Producto'}</strong>
                            <span className="text-[11px] text-slate-400">
                              Talla: <strong className="text-slate-300">{v.talla || 'Única'}</strong>
                            </span>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className="text-slate-300 font-medium">{v.cantidad_vendida || v.cantidad} uds</span>
                            <span className="text-emerald-400 font-bold block">
                              ${Number(v.total_venta || 0).toLocaleString()}
                            </span>
                          </td>

                          <td className="p-3">
                            <span className="text-slate-200 font-medium block">
                              {v.nombre_cliente || <span className="text-slate-500 italic">Sin nombre</span>}
                            </span>
                            {v.telefono_cliente && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone size={10} /> {v.telefono_cliente}
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            <span className="text-slate-300 block text-[11px]">
                              {v.direccion || <span className="text-slate-500 italic">Sin dirección</span>}
                            </span>
                            {(v.barrio || v.ciudad) && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {[v.barrio, v.ciudad].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {tieneGuia ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                <Truck size={12} /> {v.numero_guia}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAbrirEdicionVenta(v)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer"
                                title="Clic para asignar número de guía"
                              >
                                <AlertCircle size={12} /> Sin Guía (Asignar)
                              </button>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                v.estado === 'completada'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : v.estado === 'devolucion'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {v.estado || 'pendiente'}
                            </span>
                          </td>

                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAbrirEdicionVenta(v)}
                                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                title="Modificar datos o guía"
                              >
                                <Edit3 size={14} />
                              </button>

                              {!esWorker && (
                                <button
                                  type="button"
                                  onClick={() => handleEliminarVenta(v.id)}
                                  className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                                  title="Eliminar venta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER / MODAL DEL CARRITO DE VENTAS                                       */}
      {/* ========================================================================= */}
      {drawerCarritoAbierto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl">
            {/* CABECERA DEL CARRITO */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-base">Carrito de Ventas</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600/30 text-indigo-300 font-semibold">
                  {totalPrendasCarrito} prendas
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerCarritoAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* LISTA DE PRENDAS EN EL CARRITO */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {carrito.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <ShoppingCart size={40} className="mx-auto text-slate-700" />
                  <p className="text-sm font-medium">El carrito está vacío</p>
                  <p className="text-xs text-slate-600">Selecciona prendas del catálogo para comenzar.</p>
                </div>
              ) : (
                carrito.map((item) => (
                  <div
                    key={item.stockId}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                        {item.imagen ? (
                          <img
                            src={formatearUrlImagen(item.imagen) || ''}
                            alt={item.productoNombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShoppingBag size={18} className="text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{item.productoNombre}</h4>
                        <span className="text-[11px] text-slate-400 block">
                          Talla: <strong className="text-indigo-300">{item.talla}</strong>
                        </span>
                        <span className="text-xs text-emerald-400 font-semibold font-mono">
                          ${(item.precioComercial * item.cantidad).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => modificarCantidadCarrito(item.stockId, -1)}
                          className="p-1 text-slate-400 hover:text-white transition"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-200 font-mono">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => modificarCantidadCarrito(item.stockId, 1)}
                          className="p-1 text-slate-400 hover:text-white transition"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarDelCarrito(item.stockId)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* FORMULARIO DE DESPACHO / DATOS DEL CLIENTE */}
              {carrito.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={14} className="text-indigo-400" /> Datos de Envío & Cliente
                  </h4>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Nombre del Cliente *</label>
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Nombre y Apellidos"
                          value={datosDespacho.nombre_cliente}
                          onChange={(e) => setDatosDespacho({ ...datosDespacho, nombre_cliente: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Teléfono *</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            required
                            placeholder="Ej. 3001234567"
                            value={datosDespacho.telefono_cliente}
                            onChange={(e) => setDatosDespacho({ ...datosDespacho, telefono_cliente: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Ciudad</label>
                        <div className="relative">
                          <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Ej. Bogotá / Cali"
                            value={datosDespacho.ciudad}
                            onChange={(e) => setDatosDespacho({ ...datosDespacho, ciudad: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Dirección</label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Calle, Carrera, Casa"
                            value={datosDespacho.direccion}
                            onChange={(e) => setDatosDespacho({ ...datosDespacho, direccion: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Barrio</label>
                        <input
                          type="text"
                          placeholder="Barrio / Sector"
                          value={datosDespacho.barrio}
                          onChange={(e) => setDatosDespacho({ ...datosDespacho, barrio: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center justify-between">
                        <span>Número de Guía</span>
                        <span className="text-[10px] text-amber-400 font-normal">Opcional (se puede asignar luego)</span>
                      </label>
                      <div className="relative">
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Guía de transportadora (si ya la tienes)"
                          value={datosDespacho.numero_guia}
                          onChange={(e) => setDatosDespacho({ ...datosDespacho, numero_guia: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TOTAL Y BOTÓN DE CONFIRMAR */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Total a Cobrar</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  ${totalCarrito.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                disabled={procesandoVenta || carrito.length === 0 || !datosDespacho.nombre_cliente.trim() || !datosDespacho.telefono_cliente.trim()}
                onClick={handleConfirmarVenta}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 text-sm cursor-pointer"
              >
                {procesandoVenta ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Procesando Venta...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirmar & Vender ({totalPrendasCarrito} prendas)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE EDICIÓN DE VENTA (ASIGNAR GUÍA / MODIFICAR DATOS)                 */}
      {/* ========================================================================= */}
      {ventaAEditar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  Modificar Venta #{ventaAEditar.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVentaAEditar(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="text-slate-300">
                <strong>Producto:</strong> {ventaAEditar.producto_nombre} (Talla {ventaAEditar.talla || 'Única'})
              </p>
              <p className="text-slate-300">
                <strong>Total:</strong> ${Number(ventaAEditar.total_venta || 0).toLocaleString()} ({ventaAEditar.cantidad_vendida || ventaAEditar.cantidad} uds)
              </p>
              {ventaAEditar.usuario_nombre && (
                <p className="text-slate-400">
                  <strong>Vendedor:</strong> {ventaAEditar.usuario_nombre}
                </p>
              )}
            </div>

            <form onSubmit={handleGuardarEdicionVenta} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Número de Guía de Despacho
                </label>
                <input
                  type="text"
                  placeholder="Ingresa el número de guía"
                  value={datosEdicion.numero_guia}
                  onChange={(e) => setDatosEdicion({ ...datosEdicion, numero_guia: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Nombre del Cliente</label>
                  <input
                    type="text"
                    value={datosEdicion.nombre_cliente}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, nombre_cliente: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={datosEdicion.telefono_cliente}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, telefono_cliente: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Dirección</label>
                  <input
                    type="text"
                    value={datosEdicion.direccion}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, direccion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Barrio</label>
                  <input
                    type="text"
                    value={datosEdicion.barrio}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, barrio: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={datosEdicion.ciudad}
                    onChange={(e) => setDatosEdicion({ ...datosEdicion, ciudad: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                {!esWorker && (
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Estado de la Venta</label>
                    <select
                      value={datosEdicion.estado}
                      onChange={(e) => setDatosEdicion({ ...datosEdicion, estado: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="completada">Completada</option>
                      <option value="devolucion">Devolución</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setVentaAEditar(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
