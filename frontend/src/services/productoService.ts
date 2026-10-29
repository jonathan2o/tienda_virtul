import api from './api';
import type { Producto } from '../types';

export const obtenerProductos = async (): Promise<Producto[]> => {
  const response = await api.get<Producto[]>('productos/');
  return response.data;
};

export const obtenerProductoPorId = async (id: number): Promise<Producto> => {
  const response = await api.get<Producto>(`productos/${id}/`);
  return response.data;
};

export const crearProducto = async (datos: Partial<Producto>): Promise<Producto> => {
  const response = await api.post<Producto>('productos/', datos);
  return response.data;
};

export type { Producto };