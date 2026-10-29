import React from 'react';
import { MapPin } from 'lucide-react';

/**
 * Formatea limpiamente las posiciones (estantes) y filas de un producto.
 * Admite múltiples estantes ("A, B", "A-B") y múltiples filas ("1, 2", "1-2").
 */
export function formatearUbicacion(
  posicion?: string | null,
  fila?: string | number | null,
  shortFormat: boolean = false
): string {
  const pos = posicion?.trim();
  const f = fila !== undefined && fila !== null && String(fila).trim() !== '' ? String(fila).trim() : null;

  if (!pos && !f) return 'No asignada';

  if (pos && f) {
    if (shortFormat) {
      return `${pos} • F: ${f}`;
    }
    const isMultiplePos = pos.includes(',') || pos.includes('-');
    const isMultipleFila = f.includes(',') || f.includes('-');
    const posLabel = isMultiplePos ? 'Estantes' : 'Estante';
    const filaLabel = isMultipleFila ? 'Filas' : 'Fila';
    return `${posLabel} ${pos} • ${filaLabel} ${f}`;
  }

  if (pos) {
    const isMultiplePos = pos.includes(',') || pos.includes('-');
    return `${isMultiplePos ? 'Estantes' : 'Estante'} ${pos}`;
  }

  const isMultipleFila = f ? (f.includes(',') || f.includes('-')) : false;
  return `${isMultipleFila ? 'Filas' : 'Fila'} ${f}`;
}

interface UbicacionBadgeProps {
  posicion?: string | null;
  fila?: string | number | null;
  className?: string;
  shortFormat?: boolean;
}

/**
 * Componente estilizado que muestra la ubicación sin truncar el texto
 * y con icono y resaltado visual premium.
 */
export const UbicacionBadge: React.FC<UbicacionBadgeProps> = ({
  posicion,
  fila,
  className = '',
  shortFormat = false
}) => {
  const texto = formatearUbicacion(posicion, fila, shortFormat);
  const noAsignada = texto === 'No asignada';

  if (noAsignada) {
    return <span className="text-slate-500 text-xs italic">No asignada</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-slate-800/90 text-indigo-300 font-mono text-xs px-2.5 py-1 rounded-lg border border-indigo-500/30 shadow-sm whitespace-normal break-words max-w-full ${className}`}
      title={`Ubicación en almacén: ${texto}`}
    >
      <MapPin size={12} className="text-indigo-400 shrink-0" />
      <span className="font-semibold">{texto}</span>
    </span>
  );
};
