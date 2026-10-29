import api from './api';
import type { 
  Categoria, 
  Producto, 
  Stock, 
  CrearStockPayload, 
  Venta, 
  Periodo, 
  DashboardMetrics,
  ProductoMasVendido 
} from '../types';

export interface TallaStock {
  [talla: string]: number;
}

export interface ProductoUbicacion {
  id: number;
  nombre: string;
  imagen: string | null;
  precio: string;
  posicion: string;
  fila: string | number | null;
  ubicacion: string;
  stock_total: number;
  tallas: TallaStock;
}

export interface StockUbicacionResponse {
  ubicacion: string;
  productos: ProductoUbicacion[];
}

export const stockService = {
  // Categorias
  getCategorias: async (): Promise<Categoria[]> => {
    const res = await api.get<Categoria[]>('categorias/');
    return res.data;
  },
  createCategoria: async (data: Partial<Categoria>): Promise<Categoria> => {
    const res = await api.post<Categoria>('categorias/', data);
    return res.data;
  },
  updateCategoria: async (id: number, data: Partial<Categoria>): Promise<Categoria> => {
    const res = await api.patch<Categoria>(`categorias/${id}/`, data);
    return res.data;
  },
  deleteCategoria: async (id: number): Promise<void> => {
    await api.delete(`categorias/${id}/`);
  },

  // Productos
  getProductos: async (): Promise<Producto[]> => {
    const res = await api.get<Producto[]>('productos/');
    return res.data;
  },
  createProducto: async (data: Partial<Producto>): Promise<Producto> => {
    const res = await api.post<Producto>('productos/', data);
    return res.data;
  },
  createProductoWithImage: async (formData: FormData): Promise<Producto> => {
    const response = await api.post<Producto>('productos/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  updateProducto: async (id: number, data: Partial<Producto>): Promise<Producto> => {
    const res = await api.patch<Producto>(`productos/${id}/`, data);
    return res.data;
  },
  updateProductoWithImage: async (id: number, formData: FormData): Promise<Producto> => {
    const response = await api.patch<Producto>(`productos/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteProducto: async (id: number): Promise<void> => {
    await api.delete(`productos/${id}/`);
  },


  // Stock
  getStocks: async (): Promise<Stock[]> => {
    const res = await api.get<Stock[]>('stock/');
    return res.data;
  },
  getStock: async (): Promise<Stock[]> => {
    const res = await api.get<Stock[]>('stock/');
    return res.data;
  },
  createStock: async (data: CrearStockPayload): Promise<Stock> => {
    const res = await api.post<Stock>('stock/', data);
    return res.data;
  },
  updateStock: async (id: number, data: Partial<Stock>): Promise<Stock> => {
    const res = await api.patch<Stock>(`stock/${id}/`, data);
    return res.data;
  },
  deleteStock: async (id: number): Promise<void> => {
    await api.delete(`stock/${id}/`);
  },
  obtenerStockPorUbicacion: async (posicion: string, fila: string | number): Promise<StockUbicacionResponse> => {
    const res = await api.get<StockUbicacionResponse>(`stock/ubicacion/${posicion}/${fila}/`);
    return res.data;
  },

  // Ventas
  getVentas: async (params?: {
    estado?: string;
    usuario?: number;
    desde?: string;
    hasta?: string;
    guia?: string;
    cliente?: string;
  }): Promise<Venta[]> => {
    const query = new URLSearchParams();
    if (params?.estado) query.append('estado', params.estado);
    if (params?.usuario) query.append('usuario', String(params.usuario));
    if (params?.desde) query.append('desde', params.desde);
    if (params?.hasta) query.append('hasta', params.hasta);
    if (params?.guia) query.append('guia', params.guia);
    if (params?.cliente) query.append('cliente', params.cliente);

    const url = query.toString() ? `ventas/?${query.toString()}` : 'ventas/';
    const res = await api.get<Venta[]>(url);
    return res.data;
  },
  registrarVenta: async (data: {
    stock_id: number;
    cantidad_vendida?: number;
    cantidad?: number;
    nombre_cliente?: string;
    telefono_cliente?: string;
    direccion?: string;
    barrio?: string;
    ciudad?: string;
    numero_guia?: string;
    estado?: string;
  }): Promise<Venta> => {
    const payload = {
      stock_id: data.stock_id,
      cantidad_vendida: data.cantidad_vendida || data.cantidad,
      cantidad: data.cantidad || data.cantidad_vendida,
      nombre_cliente: data.nombre_cliente || '',
      telefono_cliente: data.telefono_cliente || '',
      direccion: data.direccion || '',
      barrio: data.barrio || '',
      ciudad: data.ciudad || '',
      numero_guia: data.numero_guia || '',
      estado: data.estado || 'pendiente',
    };
    const res = await api.post<Venta>('ventas/', payload);
    return res.data;
  },
  actualizarVenta: async (id: number, data: Partial<Venta>): Promise<Venta> => {
    const res = await api.patch<Venta>(`ventas/${id}/`, data);
    return res.data;
  },
  eliminarVenta: async (id: number): Promise<void> => {
    await api.delete(`ventas/${id}/`);
  },

  // Métricas de Dashboard & Gestión de Períodos
  getDashboardMetrics: async (mes?: number, anio?: number): Promise<DashboardMetrics> => {
    const params = new URLSearchParams();
    if (mes !== undefined) params.append('mes', String(mes));
    if (anio !== undefined) params.append('anio', String(anio));

    const url = params.toString() ? `stock/dashboard-metrics/?${params.toString()}` : 'stock/dashboard-metrics/';
    const res = await api.get<DashboardMetrics>(url);
    return res.data;
  },
  getMesesDisponibles: async (): Promise<Periodo[]> => {
    const res = await api.get<Periodo[]>('stock/meses-disponibles/');
    return res.data;
  },
  reiniciarMes: async (mes: number, anio: number): Promise<{ mensaje: string; ventas_eliminadas: number; periodo: Periodo }> => {
    const res = await api.post<{ mensaje: string; ventas_eliminadas: number; periodo: Periodo }>('stock/reiniciar-mes/', { mes, anio });
    return res.data;
  },
};

export const obtenerStocks = stockService.getStocks;
export const crearStock = stockService.createStock;
export const actualizarStock = stockService.updateStock;
export const eliminarStock = stockService.deleteStock;
export const obtenerStockPorUbicacion = stockService.obtenerStockPorUbicacion;
export const registrarVenta = stockService.registrarVenta;
export const actualizarVenta = stockService.actualizarVenta;
export const eliminarVenta = stockService.eliminarVenta;
export const getDashboardMetrics = stockService.getDashboardMetrics;

export type { 
  Stock, 
  CrearStockPayload, 
  Categoria, 
  Producto,
  Venta,
  Periodo,
  DashboardMetrics,
  ProductoMasVendido,
};