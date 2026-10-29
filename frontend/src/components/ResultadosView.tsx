import { useState, useEffect, useMemo } from 'react';
import { stockService } from '../services/stockService';
import { usuarioService, type UsuarioItem } from '../services/usuarioService';
import { getAuth } from '../services/authService';
import type { Venta } from '../types';
import {
  obtenerCortesRecientes,
  calcularRitmoVentasCorte,
  type PuntoRitmoDia,
} from '../utils/fechasCortes';
import {
  TrendingUp,
  Calendar,
  Wallet,
  Clock,
  CheckCircle2,
  BarChart3,
  Flame,
  Award,
  RefreshCw,
} from 'lucide-react';

export const ResultadosView = () => {
  const auth = getAuth();
  const esWorker = auth?.rol === 'worker';

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [trabajadores, setTrabajadores] = useState<UsuarioItem[]>([]);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<string>('todos');
  const [corteSeleccionadoId, setCorteSeleccionadoId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Tooltip interactivo en la gráfica
  const [puntoHover, setPuntoHover] = useState<PuntoRitmoDia | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const vnts = await stockService.getVentas();
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
      console.error('Error al cargar ventas para resultados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrar ventas por trabajador si aplica
  const ventasFiltradasPorUsuario = useMemo(() => {
    if (esWorker) return ventas;
    if (trabajadorSeleccionado === 'todos') return ventas;
    return ventas.filter(
      (v) => String(v.usuario) === trabajadorSeleccionado || v.usuario_nombre === trabajadorSeleccionado
    );
  }, [ventas, esWorker, trabajadorSeleccionado]);

  // Lista de cortes recientes calculados con las ventas filtradas
  const listaCortes = useMemo(() => {
    return obtenerCortesRecientes(ventasFiltradasPorUsuario, 8);
  }, [ventasFiltradasPorUsuario]);

  // Corte activo en pantalla (por defecto el actual)
  const corteActual = useMemo(() => {
    if (corteSeleccionadoId) {
      return listaCortes.find((c) => c.id === corteSeleccionadoId) || listaCortes[0];
    }
    return listaCortes[0];
  }, [listaCortes, corteSeleccionadoId]);

  // Datos para la gráfica de ritmo diario
  const puntosRitmo = useMemo(() => {
    if (!corteActual) return [];
    return calcularRitmoVentasCorte(corteActual, ventasFiltradasPorUsuario);
  }, [corteActual, ventasFiltradasPorUsuario]);

  // Estadísticas del corte
  const maxVentaDia = useMemo(() => {
    if (puntosRitmo.length === 0) return 0;
    return Math.max(...puntosRitmo.map((p) => p.totalVentas), 0);
  }, [puntosRitmo]);

  const diaMayorVenta = useMemo(() => {
    if (puntosRitmo.length === 0 || maxVentaDia === 0) return null;
    return puntosRitmo.find((p) => p.totalVentas === maxVentaDia);
  }, [puntosRitmo, maxVentaDia]);

  const promedioDiario = useMemo(() => {
    if (puntosRitmo.length === 0) return 0;
    const diasConVentas = puntosRitmo.filter((p) => p.totalVentas > 0).length || 1;
    return Math.round((corteActual?.totalVendido || 0) / diasConVentas);
  }, [puntosRitmo, corteActual]);

  // Dimensiones y cálculo del gráfico SVG
  const svgWidth = 800;
  const svgHeight = 260;
  const paddingX = 40;
  const paddingY = 30;

  const chartPoints = useMemo(() => {
    if (puntosRitmo.length === 0) return [];
    const divisor = maxVentaDia > 0 ? maxVentaDia : 100000;
    const stepX = (svgWidth - paddingX * 2) / (puntosRitmo.length - 1 || 1);

    return puntosRitmo.map((pt, idx) => {
      const x = paddingX + idx * stepX;
      const normalizedY = pt.totalVentas / divisor;
      const y = svgHeight - paddingY - normalizedY * (svgHeight - paddingY * 2);
      return { ...pt, x, y };
    });
  }, [puntosRitmo, maxVentaDia]);

  const svgPathD = useMemo(() => {
    if (chartPoints.length === 0) return '';
    return chartPoints.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      // Curva suave tipo bezier
      const prev = chartPoints[idx - 1];
      const cx = (prev.x + curr.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }, '');
  }, [chartPoints]);

  const svgAreaD = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const basePath = svgPathD;
    return `${basePath} L ${last.x} ${svgHeight - paddingY} L ${first.x} ${svgHeight - paddingY} Z`;
  }, [chartPoints, svgPathD]);

  return (
    <div className="space-y-6 pb-20">
      {/* CABECERA DE RESULTADOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
            <TrendingUp size={24} />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              Resultados & Ritmo de Ventas
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                Cierres 15 y 30
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              {esWorker
                ? 'Monitorea tu rendimiento quincenal, el ritmo de tus ventas y las fechas de tus pagos.'
                : 'Supervisión de métricas de ventas por cortes quincenales y liquidaciones programadas.'}
            </p>
          </div>
        </div>

        {/* SELECTOR DE TRABAJADOR (SOLO ADMIN) & RECARGAR */}
        <div className="flex items-center gap-2.5">
          {!esWorker && (
            <div className="relative">
              <select
                value={trabajadorSeleccionado}
                onChange={(e) => setTrabajadorSeleccionado(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                <option value="todos">Todos los Trabajadores (General)</option>
                {trabajadores.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    Trabajador: {t.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={cargarDatos}
            title="Recargar métricas"
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* PANEL DESTACADO: CORTE QUINCENAL & CALENDARIO DE PAGOS */}
      {corteActual && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* TARJETA 1: CORTE ACTUAL & CIERRE */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} /> {corteActual.esCorteActual ? 'Corte Quincenal Activo' : 'Corte Seleccionado'}
              </span>
              {corteActual.esCorteActual ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold animate-pulse">
                  En curso
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
                  Corte Finalizado
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-100">
                {corteActual.tituloCorte}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Fecha límite de cierre: <strong className="text-slate-200">{corteActual.fechaCierreStr} a las 23:59</strong>
              </p>
            </div>

            {corteActual.esCorteActual && (
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
                  <Clock size={14} /> Días restantes para el cierre:
                </span>
                <span className="text-sm font-bold text-indigo-200 font-mono">
                  {corteActual.diasParaCierre} {corteActual.diasParaCierre === 1 ? 'día' : 'días'}
                </span>
              </div>
            )}
          </div>

          {/* TARJETA 2: FECHA PROGRAMADA DE PAGO */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet size={13} /> Fecha Programada de Pago
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                {corteActual.quincena === 1 ? 'Pago día 20' : 'Pago día 5'}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block">Tu pago se efectuará el:</span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-300 mt-0.5">
                {corteActual.fechaPagoStr}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {corteActual.quincena === 1
                  ? 'Los cortes del 1 al 15 se pagan puntualmente los días 20 del mes.'
                  : 'Los cortes del 16 al 30 se pagan puntualmente los días 5 del mes siguiente.'}
              </p>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> Sistema de Pagos Automatizado
              </span>
              <span className="text-emerald-400 font-semibold font-mono">Activo</span>
            </div>
          </div>

          {/* TARJETA 3: TOTAL GENERADO EN EL CORTE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Acumulado del Período
            </span>

            <div>
              <span className="text-2xl sm:text-3xl font-extrabold text-white block">
                ${corteActual.totalVendido.toLocaleString()}
              </span>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span>{corteActual.unidadesVendidas} prendas vendidas</span>
                <span>•</span>
                <span>{corteActual.cantidadVentas} pedidos</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Promedio / día:</span>
              <strong className="text-indigo-400 font-mono">${promedioDiario.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GRÁFICA CREATIVA DE RITMO DE VENTAS                                       */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 size={20} className="text-indigo-400" />
              Ritmo de Ventas Diario
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Evolución y picos de ventas durante el corte ({corteActual?.tituloCorte})
            </p>
          </div>

          {/* INDICADORES DE RITMO */}
          <div className="flex items-center gap-3">
            {diaMayorVenta && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-1.5 font-medium">
                <Flame size={14} className="text-amber-400" />
                <span>Pico más alto: Día {diaMayorVenta.dia} (${diaMayorVenta.totalVentas.toLocaleString()})</span>
              </div>
            )}
          </div>
        </div>

        {/* CONTENEDOR DEL GRÁFICO SVG RESPONSIVE */}
        <div className="relative w-full overflow-hidden bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 sm:p-4">
          {/* TOOLTIP FLOTANTE INTERACTIVO */}
          {puntoHover && (
            <div className="absolute top-4 right-4 z-20 bg-slate-900/95 border border-indigo-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1 animate-fadeIn pointer-events-none">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar size={12} className="text-indigo-400" />
                {puntoHover.etiqueta} ({puntoHover.fechaStr})
              </div>
              <div className="text-emerald-400 font-extrabold text-sm font-mono">
                ${puntoHover.totalVentas.toLocaleString()}
              </div>
              <div className="text-slate-400 text-[11px]">
                {puntoHover.unidades} unidades ({puntoHover.cantidadVentas} ventas)
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-48 sm:h-64 overflow-visible"
          >
            <defs>
              {/* GRADIENTE DE ÁREA BAJO LA CURVA */}
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#818cf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>

              {/* GRADIENTE DE LÍNEA */}
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* LÍNEAS GUÍA HORIZONTALES */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const yVal = paddingY + pct * (svgHeight - paddingY * 2);
              return (
                <line
                  key={i}
                  x1={paddingX}
                  y1={yVal}
                  x2={svgWidth - paddingX}
                  y2={yVal}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

            {/* ÁREA SOMBREADA */}
            {svgAreaD && (
              <path d={svgAreaD} fill="url(#areaGradient)" />
            )}

            {/* LÍNEA DE RITMO */}
            {svgPathD && (
              <path
                d={svgPathD}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* PUNTOS DE DATOS INTERACTIVOS */}
            {chartPoints.map((pt) => {
              const esMaximo = pt.totalVentas === maxVentaDia && maxVentaDia > 0;
              const tieneVentas = pt.totalVentas > 0;

              return (
                <g key={pt.dia} className="cursor-pointer">
                  {/* CÍRCULO INVISIBLE PARA FACILITAR EL HOVER */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="14"
                    fill="transparent"
                    onMouseEnter={() => setPuntoHover(pt)}
                    onMouseLeave={() => setPuntoHover(null)}
                  />

                  {/* CÍRCULO VISIBLE */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={esMaximo ? '5.5' : tieneVentas ? '4' : '2.5'}
                    fill={esMaximo ? '#fbbf24' : tieneVentas ? '#34d399' : '#475569'}
                    stroke="#0f172a"
                    strokeWidth="2"
                    className="transition-transform duration-200 hover:scale-150"
                  />

                  {/* ETIQUETA DÍA EN EL EJE X */}
                  <text
                    x={pt.x}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {pt.dia}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HISTORIAL DE CORTES QUINCENALES (15 Y 30) Y FECHAS DE PAGO                */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Award size={18} className="text-indigo-400" />
              Historial de Cortes Quincenales
            </h3>
            <p className="text-xs text-slate-400">
              Haz clic en cualquier corte para visualizar sus estadísticas y gráfica de ritmo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {listaCortes.map((corte) => {
            const isSelected = corte.id === corteActual?.id;

            return (
              <div
                key={corte.id}
                onClick={() => setCorteSeleccionadoId(corte.id)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {corte.mesNombre} {corte.anio} • Q{corte.quincena}
                    </span>
                    {corte.esCorteActual && (
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                        Actual
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mt-1">{corte.tituloCorte}</h4>
                </div>

                <div>
                  <span className="text-lg font-extrabold text-emerald-400 font-mono block">
                    ${corte.totalVendido.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {corte.unidadesVendidas} prendas • {corte.cantidadVentas} ventas
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Pago:</span>
                  <strong className="text-slate-300">{corte.fechaPagoStr}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
