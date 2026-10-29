import { useState, useEffect } from 'react';
import { stockService } from '../services/stockService';
import type { DashboardMetrics, Periodo, Venta } from '../types';
import { 
  Boxes, 
  Store, 
  TrendingUp, 
  DollarSign, 
  Coins, 
  ShoppingCart,
  LineChart, 
  Calendar, 
  RefreshCw, 
  RotateCcw, 
  AlertTriangle, 
  X, 
  CheckCircle2,
  Flame,
  Trophy,
  ArrowRight,
  PackageCheck
} from 'lucide-react';

export const Dashboard = ({ onNavigate }: { onNavigate: (tab: string) => void }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_ventas: 0,
    total_stock_vendido: 0,
    total_precio_recibido: 0,
    total_precio_comercial: 0,
    total_unidades_disponibles: 0,
  });

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<{ mes: number; anio: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ventasHistoricas, setVentasHistoricas] = useState<Venta[]>([]);

  // Estado del ranking de productos más vendidos ('historico' por defecto para visibilidad acumulada persistente)
  const [rankingTab, setRankingTab] = useState<'historico' | 'periodo'>('historico');

  // Lightbox para fotos
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Estado del modal de reinicio de mes
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedbackMensaje, setFeedbackMensaje] = useState<string | null>(null);

  const formatearUrlImagen = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const cargarPeriodosYDatos = async () => {
    setLoading(true);
    try {
      const [mesesDisponibles, todasLasVentas] = await Promise.all([
        stockService.getMesesDisponibles(),
        stockService.getVentas()
      ]);
      setPeriodos(mesesDisponibles);
      setVentasHistoricas(todasLasVentas || []);

      const periodoActivo = periodoSeleccionado || (mesesDisponibles.length > 0 ? { mes: mesesDisponibles[0].mes, anio: mesesDisponibles[0].anio } : null);
      if (periodoActivo) {
        setPeriodoSeleccionado(periodoActivo);
        const dashMetrics = await stockService.getDashboardMetrics(periodoActivo.mes, periodoActivo.anio);
        setMetrics(dashMetrics);
      } else {
        const dashMetrics = await stockService.getDashboardMetrics();
        setMetrics(dashMetrics);
      }
    } catch (e) {
      console.error('Error al cargar datos del dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const cambiarPeriodo = async (mes: number, anio: number) => {
    setLoading(true);
    setPeriodoSeleccionado({ mes, anio });
    try {
      const dashMetrics = await stockService.getDashboardMetrics(mes, anio);
      setMetrics(dashMetrics);
    } catch (e) {
      console.error('Error al cambiar de período:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPeriodosYDatos();
  }, []);

  const handleConfirmarReinicio = async () => {
    if (!periodoSeleccionado) return;
    setResetting(true);
    try {
      const res = await stockService.reiniciarMes(periodoSeleccionado.mes, periodoSeleccionado.anio);
      setFeedbackMensaje(res.mensaje || 'Período reiniciado con éxito.');
      setShowResetModal(false);
      await cargarPeriodosYDatos();
    } catch (e) {
      console.error('Error al reiniciar período:', e);
      alert('Error al reiniciar las ventas del período seleccionado.');
    } finally {
      setResetting(false);
    }
  };

  const nombrePeriodoActual = metrics.periodo?.nombre_mes || (periodoSeleccionado ? `Mes ${periodoSeleccionado.mes}/${periodoSeleccionado.anio}` : 'Período Actual');

  // Cálculos de Ganancia Bruta y Rentabilidad Global (%)
  const costoTotalVendido = Number(metrics.total_precio_recibido);
  const totalVentasNum = Number(metrics.total_ventas);
  const gananciaBruta = Math.max(0, totalVentasNum - costoTotalVendido);
  const porcentajeRentabilidad = costoTotalVendido > 0 ? (gananciaBruta / costoTotalVendido) * 100 : 0;

  // Total de Productos / Unidades Vendidas en el período seleccionado
  const totalProductosVendidos = metrics.total_productos_vendidos ?? metrics.total_stock_vendido ?? 0;
  const articulosDistintos = metrics.total_articulos_distintos_vendidos ?? (metrics.productos_mas_vendidos || []).length;

  const financialCards = [
    { 
      title: 'Total Ventas', 
      value: `$${totalVentasNum.toLocaleString()}`, 
      subtitle: `Facturación en ${nombrePeriodoActual}`,
      icon: DollarSign, 
      color: 'from-emerald-500 to-teal-600', 
      tab: 'stock' 
    },
    { 
      title: 'Total Productos Vendidos', 
      value: `${totalProductosVendidos.toLocaleString()} uds`, 
      subtitle: `${articulosDistintos} artículos vendidos en ${nombrePeriodoActual}`,
      icon: ShoppingCart, 
      color: 'from-blue-500 to-indigo-600', 
      tab: 'stock' 
    },
    { 
      title: 'Total Precio Recibido', 
      value: `$${costoTotalVendido.toLocaleString()}`, 
      subtitle: 'Costo total de adquisición vendido',
      icon: Coins, 
      color: 'from-amber-500 to-orange-600', 
      tab: 'stock' 
    },
    { 
      title: 'Ganancia Bruta Estimada', 
      value: `$${gananciaBruta.toLocaleString()}`, 
      percentage: porcentajeRentabilidad,
      subtitle: `Rentabilidad: +${porcentajeRentabilidad.toFixed(1)}% sobre costo`,
      icon: TrendingUp, 
      color: 'from-cyan-500 to-blue-600', 
      tab: 'stock' 
    },
    { 
      title: 'Unidades Disponibles', 
      value: `${metrics.total_unidades_disponibles.toLocaleString()} uds`, 
      subtitle: 'Stock físico en almacén',
      icon: Boxes, 
      color: 'from-purple-500 to-violet-600', 
      tab: 'stock' 
    },
  ];

  // 1. Cálculo del Total Global de Unidades Vendidas acumuladas en el histórico:
  // Sumatoria directa de todas las transacciones individuales históricas (campo cantidad_vendida o cantidad)
  const sumatoriaTotalVentasTransacciones = ventasHistoricas.reduce(
    (sum, v) => sum + (Number(v.cantidad_vendida ?? v.cantidad) || 0),
    0
  );

  const sumatoriaTotalIngresosTransacciones = ventasHistoricas.reduce(
    (sum, v) => sum + (Number(v.total_venta) || 0),
    0
  );

  // Sumatoria sobre la lista completa del ranking histórico
  const sumatoriaProductosHistoricos = (metrics.productos_mas_vendidos_historico || []).reduce(
    (sum, item) => sum + (Number(item.unidades_vendidas) || 0), 
    0
  );

  const sumatoriaIngresosHistoricos = (metrics.productos_mas_vendidos_historico || []).reduce(
    (sum, item) => sum + (Number(item.total_generado) || 0), 
    0
  );

  // Total Global Vendido: Suma matemática exacta de todas las unidades vendidas en la base de datos
  const totalGlobalVendido = ventasHistoricas.length > 0
    ? sumatoriaTotalVentasTransacciones
    : (metrics.total_historico_vendido !== undefined
        ? Number(metrics.total_historico_vendido)
        : sumatoriaProductosHistoricos);

  // Facturación Histórica Global
  const totalGlobalIngresos = ventasHistoricas.length > 0
    ? sumatoriaTotalIngresosTransacciones
    : (metrics.total_historico_ingresos !== undefined
        ? Number(metrics.total_historico_ingresos)
        : sumatoriaIngresosHistoricos);

  // Listado de más vendidos: acumulado histórico por defecto (persistente) o período filtrado
  const listadoMasVendidos = rankingTab === 'historico'
    ? (metrics.productos_mas_vendidos_historico && metrics.productos_mas_vendidos_historico.length > 0 
        ? metrics.productos_mas_vendidos_historico 
        : (metrics.productos_mas_vendidos || []))
    : (metrics.productos_mas_vendidos || []);

  // Ordenar de mayor a menor según las unidades vendidas por producto
  const listadoMasVendidosOrdenado = [...listadoMasVendidos].sort(
    (a, b) => (b.unidades_vendidas || 0) - (a.unidades_vendidas || 0)
  );

  const maxUnidadesVendidas = listadoMasVendidosOrdenado.length > 0
    ? Math.max(...listadoMasVendidosOrdenado.map((p) => p.unidades_vendidas), 1)
    : 1;

  const totalUnidadesListado = listadoMasVendidosOrdenado.reduce(
    (sum, item) => sum + (Number(item.unidades_vendidas) || 0),
    0
  );

  const totalIngresosListado = listadoMasVendidosOrdenado.reduce(
    (sum, item) => sum + (Number(item.total_generado) || 0),
    0
  );

  const totalGananciasListado = listadoMasVendidosOrdenado.reduce(
    (sum, item) => sum + (Number(item.ganancia_generada) || 0),
    0
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* HEADER CON SELECTOR DE PERÍODO MENSUAL Y ACCIONES */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2 sm:gap-2.5">
            <LineChart className="text-indigo-400 shrink-0" size={24} /> <span>Panel de Control & Métricas Financieras</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Resumen contable y operacional filtrado por períodos mensuales
          </p>
        </div>

        {/* SELECTOR DE PERÍODO & BOTONES */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* SELECTOR DE MES */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 sm:py-2 rounded-xl">
            <Calendar size={16} className="text-indigo-400 shrink-0" />
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase">Período:</span>
            <select
              value={periodoSeleccionado ? `${periodoSeleccionado.anio}-${periodoSeleccionado.mes}` : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                const [anioStr, mesStr] = e.target.value.split('-');
                cambiarPeriodo(Number(mesStr), Number(anioStr));
              }}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-lg px-2 sm:px-2.5 py-1 focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
            >
              {periodos.map((p) => (
                <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                  {p.nombre_mes}
                </option>
              ))}
            </select>
          </div>

          {/* BOTÓN REINICIAR MES */}
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition cursor-pointer"
            title={`Reiniciar ventas de ${nombrePeriodoActual}`}
          >
            <RotateCcw size={14} /> <span>Reiniciar Mes</span>
          </button>

          {/* BOTÓN RECARGAR */}
          <button
            onClick={cargarPeriodosYDatos}
            className="p-2 sm:p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            title="Recargar métricas"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          </button>
        </div>
      </div>

      {/* FEEDBACK ALERTA */}
      {feedbackMensaje && (
        <div className="p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs sm:text-sm flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{feedbackMensaje}</span>
          </div>
          <button onClick={() => setFeedbackMensaje(null)} className="text-emerald-400/80 hover:text-emerald-400 p-1 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* TARJETAS FINANCIERAS PRINCIPALES DEL PERÍODO (INCLUYE TOTAL PRODUCTOS VENDIDOS Y GANANCIA BRUTA CON %) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
          <h3 className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-400 shrink-0" /> Métricas del Período: <span className="text-indigo-400 font-mono">{nombrePeriodoActual}</span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-500">Actualización contable en tiempo real</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {financialCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate(card.tab)}
                className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl cursor-pointer hover:border-slate-700 hover:scale-[1.01] transition-all duration-200 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-400 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">{card.title}</span>
                    <div className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-lg`}>
                      <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </div>
                  </div>
                  
                  {/* MONTO Y PORCENTAJE EN GANANCIA BRUTA ESTIMADA */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-100 font-mono">
                      {loading ? '...' : card.value}
                    </div>
                    {card.percentage !== undefined && !loading && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap shadow-sm">
                        +{card.percentage.toFixed(1)}% Rent.
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">{card.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN INFERIOR: RANKING DE PRODUCTOS MÁS VENDIDOS (PERSISTENTE Y ACUMULADO) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        {/* CABECERA CON TÍTULO, BADGE TOTAL GLOBAL VENDIDO Y SELECTOR DE PESTAÑAS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Flame size={22} className="text-amber-400 shrink-0" /> 
                <span>Ranking de Productos Más Vendidos</span>
              </h3>

              {/* BADGE / INSIGNIA DESTACADA: TOTAL GLOBAL VENDIDO */}
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/20 to-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-sm"
                title="Suma acumulada histórica de todas las unidades vendidas de todos los productos en la tienda"
              >
                <PackageCheck size={16} className="text-emerald-400 shrink-0" />
                <span className="text-xs font-medium">
                  Total Global Vendido:{' '}
                  <strong className="text-emerald-200 font-mono text-sm font-extrabold">
                    {loading ? '...' : totalGlobalVendido.toLocaleString()}
                  </strong>{' '}
                  <span className="text-emerald-400/80 font-normal">unidades</span>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              {rankingTab === 'historico'
                ? 'Acumulado histórico total sumando todos los períodos de venta'
                : `Ventas registradas exclusivamente en ${nombrePeriodoActual}`}
            </p>
          </div>

          {/* SELECTOR DE PESTAÑAS: ACUMULADO HISTÓRICO GLOBAL (POR DEFECTO) VS PERÍODO ACTUAL */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start lg:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => setRankingTab('historico')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                rankingTab === 'historico'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Acumulado Histórico Global</span>
            </button>
            <button
              type="button"
              onClick={() => setRankingTab('periodo')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                rankingTab === 'periodo'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>En {nombrePeriodoActual}</span>
            </button>
          </div>
        </div>

        {/* TARJETAS RESUMEN DE LA SECCIÓN (MINI-STATS) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Total Histórico Vendido
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                {loading ? '...' : `${totalGlobalVendido.toLocaleString()} uds`}
              </div>
              <div className="text-[10px] text-slate-500">Suma total histórica de unidades</div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PackageCheck size={18} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Facturación Histórica
              </div>
              <div className="text-lg font-bold font-mono text-indigo-300 mt-0.5">
                {loading ? '...' : `$${totalGlobalIngresos.toLocaleString()}`}
              </div>
              <div className="text-[10px] text-slate-500">Ingreso bruto acumulado</div>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <DollarSign size={18} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                {rankingTab === 'historico' ? 'Productos en Ranking' : `Artículos Vendidos en ${nombrePeriodoActual}`}
              </div>
              <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                {loading ? '...' : `${listadoMasVendidosOrdenado.length} productos`}
              </div>
              <div className="text-[10px] text-slate-500">
                {rankingTab === 'historico' ? 'Catálogo con ventas registradas' : `${totalUnidadesListado.toLocaleString()} unidades en el mes`}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy size={18} />
            </div>
          </div>
        </div>

        {/* TABLA Y LISTADO DE PRODUCTOS MÁS VENDIDOS */}
        {listadoMasVendidosOrdenado.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-500 space-y-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <Trophy size={36} className="mx-auto text-slate-600" />
            <p className="text-sm sm:text-base font-medium text-slate-400">
              {rankingTab === 'periodo'
                ? `No se registran ventas en ${nombrePeriodoActual}.`
                : 'Aún no hay transacciones de venta registradas en el historial.'}
            </p>
            <p className="text-xs text-slate-600">
              {rankingTab === 'periodo' ? (
                <button
                  onClick={() => setRankingTab('historico')}
                  className="text-indigo-400 hover:underline cursor-pointer"
                >
                  Ver el ranking acumulado histórico global
                </button>
              ) : (
                'Realiza ventas desde el Control de Stock & POS para alimentar el ranking.'
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase bg-slate-950/60">
                  <th className="p-3 text-center w-14"># Rank</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3 min-w-[150px]">Unidades Acumuladas Vendidas</th>
                  <th className="p-3 text-right">Ingresos Totales Generados</th>
                  <th className="p-3 text-right">Ganancia Est.</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs sm:text-sm">
                {listadoMasVendidosOrdenado.map((prod, index) => {
                  const rankPos = index + 1;
                  const pctRelativo = Math.round((prod.unidades_vendidas / maxUnidadesVendidas) * 100);
                  const imgUrl = formatearUrlImagen(prod.imagen);

                  return (
                    <tr key={`${prod.id}-${index}`} className="hover:bg-slate-800/40 transition">
                      {/* POSICIÓN DE RANKING */}
                      <td className="p-3 text-center">
                        {rankPos === 1 ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20" title="1º Lugar en ventas">
                            <Trophy size={14} />
                          </div>
                        ) : rankPos === 2 ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950 font-black text-xs shadow-md" title="2º Lugar en ventas">
                            2º
                          </div>
                        ) : rankPos === 3 ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-amber-700 to-orange-800 text-amber-100 font-black text-xs shadow-md" title="3º Lugar en ventas">
                            3º
                          </div>
                        ) : (
                          <span className="font-mono text-slate-500 font-bold text-xs">
                            #{rankPos}
                          </span>
                        )}
                      </td>

                      {/* PRODUCTO (FOTO + NOMBRE) */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {imgUrl ? (
                            <div 
                              onClick={() => setLightboxImage({ url: imgUrl, title: prod.nombre })}
                              className="w-10 h-10 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 cursor-pointer group shadow-sm"
                              title="Clic para ampliar foto"
                            >
                              <img 
                                src={imgUrl} 
                                alt={prod.nombre} 
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0">
                              <Store size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-100 text-xs sm:text-sm">{prod.nombre}</div>
                            <span className="text-[10px] text-slate-500 font-mono">ID #{prod.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* CATEGORÍA */}
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                          {prod.categoria}
                        </span>
                      </td>

                      {/* UNIDADES ACUMULADAS VENDIDAS */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono font-bold text-indigo-300">
                            <span>{prod.unidades_vendidas} uds</span>
                            <span className="text-[10px] text-slate-500 font-normal">{pctRelativo}% del top</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              style={{ width: `${pctRelativo}%` }} 
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                            />
                          </div>
                        </div>
                      </td>

                      {/* INGRESOS TOTALES GENERADOS */}
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                          ${prod.total_generado.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-slate-500 block">Facturación</span>
                      </td>

                      {/* GANANCIA GENERADA */}
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold text-cyan-400 text-xs sm:text-sm">
                          +${(prod.ganancia_generada || 0).toLocaleString()}
                        </div>
                        <span className="text-[10px] text-slate-500 block">Utilidad</span>
                      </td>

                      {/* ACCIÓN: VER EN POS */}
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigate('stock')}
                          className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium transition cursor-pointer inline-flex items-center gap-1"
                          title="Gestionar este producto en Stock & POS"
                        >
                          <span>POS</span> <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950/80 border-t-2 border-slate-800 text-xs font-mono font-bold text-slate-300">
                <tr>
                  <td colSpan={3} className="p-3 text-right uppercase text-[11px] text-slate-400 tracking-wider">
                    Total en Lista ({listadoMasVendidosOrdenado.length} productos):
                  </td>
                  <td className="p-3 text-indigo-300">
                    <span className="text-xs sm:text-sm font-extrabold">{totalUnidadesListado.toLocaleString()} uds</span>
                  </td>
                  <td className="p-3 text-right text-emerald-400">
                    <span className="text-xs sm:text-sm font-extrabold">${totalIngresosListado.toLocaleString()}</span>
                  </td>
                  <td className="p-3 text-right text-cyan-400">
                    <span className="text-xs sm:text-sm font-extrabold">+${totalGananciasListado.toLocaleString()}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ESTADO DEL MOTOR DE DOMINIO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 sm:p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-200">Motor de Dominio & Auditoría Contable</h3>
            <p className="text-xs text-slate-400">Django REST API en /api/stock/</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Las métricas financieras se calculan en base a las ventas reales congeladas en el período seleccionado. Cada venta preserva el costo de adquisición (<code className="text-amber-300">precio_recibido_historico</code>) y el precio de venta (<code className="text-emerald-300">precio_comercial_historico</code>), permitiendo una auditoría financiera exacta por mes y año sin tocar la estructura de la base de datos.
        </p>
      </div>

      {/* LIGHTBOX MODAL PARA FOTOS */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200 text-sm">{lightboxImage.title}</span>
              <button 
                onClick={() => setLightboxImage(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              <img 
                src={lightboxImage.url} 
                alt={lightboxImage.title} 
                className="w-full h-auto max-h-[65vh] object-contain" 
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA REINICIAR MES */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-400 shrink-0" /> Reiniciar Métricas del Período
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs sm:text-sm space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-rose-400">
                <AlertTriangle size={16} /> Acción irreversible
              </p>
              <p className="text-xs text-rose-300/90 leading-relaxed">
                Estás a punto de eliminar todas las transacciones de venta registradas en <strong>{nombrePeriodoActual}</strong>. Las métricas de este mes se reiniciarán a $0.00.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl font-medium transition cursor-pointer text-xs sm:text-sm text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleConfirmarReinicio}
                className="w-full sm:w-auto px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 cursor-pointer text-xs sm:text-sm"
              >
                <RotateCcw size={15} /> {resetting ? 'Reiniciando...' : 'Sí, Reiniciar Período'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
