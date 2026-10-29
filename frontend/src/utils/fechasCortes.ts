import type { Venta } from '../types';

export const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export interface InfoCorte {
  id: string; // ej. "2026-10-Q1"
  anio: number;
  mes: number; // 1 - 12
  mesNombre: string;
  quincena: 1 | 2;
  tituloCorte: string; // ej. "1 al 15 de Octubre 2026"
  fechaInicioStr: string; // YYYY-MM-DD
  fechaFinStr: string; // YYYY-MM-DD
  diaCierre: number;
  fechaCierreStr: string; // ej. "15 de Octubre"
  fechaPagoStr: string; // ej. "20 de Octubre" o "5 de Noviembre"
  diasParaCierre: number;
  esCorteActual: boolean;
  totalVendido: number;
  cantidadVentas: number;
  unidadesVendidas: number;
}

export interface PuntoRitmoDia {
  dia: number;
  fechaStr: string;
  etiqueta: string;
  totalVentas: number;
  cantidadVentas: number;
  unidades: number;
}

/**
 * Obtiene el último día del mes (28, 29, 30 o 31).
 */
export function obtenerUltimoDiaMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/**
 * Genera la información de un corte específico.
 */
export function generarInfoCorte(
  anio: number,
  mes: number,
  quincena: 1 | 2,
  ventas: Venta[] = [],
  fechaReferencia: Date = new Date()
): InfoCorte {
  const mesIdx = mes - 1;
  const mesNombre = NOMBRES_MESES[mesIdx];
  const ultimoDia = obtenerUltimoDiaMes(anio, mes);

  const diaInicio = quincena === 1 ? 1 : 16;
  const diaFin = quincena === 1 ? 15 : ultimoDia;

  const mmStr = String(mes).padStart(2, '0');
  const fechaInicioStr = `${anio}-${mmStr}-${String(diaInicio).padStart(2, '0')}`;
  const fechaFinStr = `${anio}-${mmStr}-${String(diaFin).padStart(2, '0')}`;

  const tituloCorte = `${diaInicio} al ${diaFin} de ${mesNombre} ${anio}`;
  const fechaCierreStr = `${diaFin} de ${mesNombre}`;

  // Regla de pago:
  // Corte 1 (1 al 15) -> Pago el 20 del mismo mes.
  // Corte 2 (16 al 30/31) -> Pago el 5 del mes siguiente.
  let fechaPagoStr = '';
  if (quincena === 1) {
    fechaPagoStr = `20 de ${mesNombre} ${anio}`;
  } else {
    const siguienteMes = mes === 12 ? 1 : mes + 1;
    const siguienteAnio = mes === 12 ? anio + 1 : anio;
    const siguienteMesNombre = NOMBRES_MESES[siguienteMes - 1];
    fechaPagoStr = `5 de ${siguienteMesNombre} ${siguienteAnio}`;
  }

  // Evaluar si es el corte actual según la fecha de referencia
  const anioActual = fechaReferencia.getFullYear();
  const mesActual = fechaReferencia.getMonth() + 1;
  const diaActual = fechaReferencia.getDate();
  const quincenaActual = diaActual <= 15 ? 1 : 2;

  const esCorteActual = (anio === anioActual && mes === mesActual && quincena === quincenaActual);

  let diasParaCierre = 0;
  if (esCorteActual) {
    diasParaCierre = Math.max(0, diaFin - diaActual);
  } else {
    const finDate = new Date(anio, mesIdx, diaFin, 23, 59, 59);
    if (fechaReferencia > finDate) {
      diasParaCierre = 0; // ya cerró
    } else {
      const diffMs = finDate.getTime() - fechaReferencia.getTime();
      diasParaCierre = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // Filtrar ventas que corresponden a este corte
  const ventasDelCorte = ventas.filter((v) => {
    if (!v.fecha_venta) return false;
    const fv = new Date(v.fecha_venta);
    const vAnio = fv.getFullYear();
    const vMes = fv.getMonth() + 1;
    const vDia = fv.getDate();
    return vAnio === anio && vMes === mes && vDia >= diaInicio && vDia <= diaFin;
  });

  const totalVendido = ventasDelCorte.reduce((acc, v) => acc + Number(v.total_venta || 0), 0);
  const unidadesVendidas = ventasDelCorte.reduce((acc, v) => acc + Number(v.cantidad_vendida || v.cantidad || 0), 0);

  return {
    id: `${anio}-${mmStr}-Q${quincena}`,
    anio,
    mes,
    mesNombre,
    quincena,
    tituloCorte,
    fechaInicioStr,
    fechaFinStr,
    diaCierre: diaFin,
    fechaCierreStr,
    fechaPagoStr,
    diasParaCierre,
    esCorteActual,
    totalVendido,
    cantidadVentas: ventasDelCorte.length,
    unidadesVendidas,
  };
}

/**
 * Obtiene la lista de cortes recientes (corte actual y los N cortes anteriores).
 */
export function obtenerCortesRecientes(ventas: Venta[] = [], cantidadCortes = 6): InfoCorte[] {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const dia = hoy.getDate();
  const quincenaActual: 1 | 2 = dia <= 15 ? 1 : 2;

  const lista: InfoCorte[] = [];

  let curAnio = anio;
  let curMes = mes;
  let curQ: 1 | 2 = quincenaActual;

  for (let i = 0; i < cantidadCortes; i++) {
    lista.push(generarInfoCorte(curAnio, curMes, curQ, ventas, hoy));

    if (curQ === 2) {
      curQ = 1;
    } else {
      curQ = 2;
      if (curMes === 1) {
        curMes = 12;
        curAnio -= 1;
      } else {
        curMes -= 1;
      }
    }
  }

  return lista;
}

/**
 * Agrupa las ventas día por día dentro de un corte para la gráfica de ritmo.
 */
export function calcularRitmoVentasCorte(corte: InfoCorte, ventas: Venta[]): PuntoRitmoDia[] {
  const diaInicio = corte.quincena === 1 ? 1 : 16;
  const diaFin = corte.diaCierre;
  const puntos: PuntoRitmoDia[] = [];

  for (let d = diaInicio; d <= diaFin; d++) {
    puntos.push({
      dia: d,
      fechaStr: `${corte.anio}-${String(corte.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      etiqueta: `Día ${d}`,
      totalVentas: 0,
      cantidadVentas: 0,
      unidades: 0,
    });
  }

  ventas.forEach((v) => {
    if (!v.fecha_venta) return;
    const fv = new Date(v.fecha_venta);
    if (fv.getFullYear() === corte.anio && fv.getMonth() + 1 === corte.mes) {
      const diaVenta = fv.getDate();
      const pt = puntos.find((p) => p.dia === diaVenta);
      if (pt) {
        pt.totalVentas += Number(v.total_venta || 0);
        pt.cantidadVentas += 1;
        pt.unidades += Number(v.cantidad_vendida || v.cantidad || 0);
      }
    }
  });

  return puntos;
}
