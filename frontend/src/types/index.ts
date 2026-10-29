export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

export interface Talla {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string | null;
  talla?: string | null;
  categoria?: Categoria | null;
  categoria_id?: number | null;
  imagen?: string | null;
  imagen_guia_tallas?: string | null;
  precio_recibido?: string | number;
  precio_comercial?: string | number;
  precio: string | number;
  posicion?: string;
  fila?: string | number | null;
  activo: boolean;
  stock_total?: number;
}


export interface Stock {
  id: number;
  producto: string | number;
  producto_id?: number;
  producto_detail?: Producto;
  talla?: string | null;
  ubicacion?: string;
  precio_recibido: number | string;
  precio_comercial: number | string;
  porcentaje_margen: number | string;
  cantidad: number; // Representa el Stock Disponible
}

export interface CrearStockPayload {
  producto_id: number;
  categoria_id?: number | null;
  talla?: string;
  cantidad: number;
  porcentaje_margen?: number;
  precio_recibido?: number;
  precio_comercial?: number;
}

export interface Venta {
  id: number;
  stock?: Stock | null;
  stock_id?: number;
  producto_nombre?: string;
  talla?: string;
  cantidad_vendida: number;
  cantidad?: number;
  precio_recibido_historico: number | string;
  precio_comercial_historico: number | string;
  total_venta: number | string;
  fecha_venta: string;
  nombre_cliente?: string;
  telefono_cliente?: string;
  direccion?: string;
  barrio?: string;
  ciudad?: string;
  numero_guia?: string;
  estado?: string;
  usuario?: number | null;
  usuario_nombre?: string;
}

export interface Periodo {
  mes: number;
  anio: number;
  nombre_mes: string;
}

export interface ProductoMasVendido {
  id: number;
  nombre: string;
  categoria: string;
  imagen?: string | null;
  unidades_vendidas: number;
  total_generado: number;
  costo_total?: number;
  ganancia_generada?: number;
}

export interface DashboardMetrics {
  periodo?: Periodo;
  total_ventas: number;
  total_stock_vendido: number;
  total_productos_vendidos?: number;
  total_articulos_distintos_vendidos?: number;
  total_precio_recibido: number;
  total_precio_comercial: number;
  total_unidades_disponibles: number;
  total_historico_vendido?: number;
  total_historico_ingresos?: number;
  total_productos?: number;
  productos_disponibles?: number;
  productos_no_disponibles?: number;
  productos_mas_vendidos?: ProductoMasVendido[];
  productos_mas_vendidos_historico?: ProductoMasVendido[];
}
