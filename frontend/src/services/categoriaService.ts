import api from './api';
import type { Categoria } from '../types';

export const obtenerCategorias = async (): Promise<Categoria[]> => {
  const response = await api.get<Categoria[]>('categorias/');
  return response.data;
};

export const crearCategoria = async (datos: Partial<Categoria>): Promise<Categoria> => {
  const response = await api.post<Categoria>('categorias/', datos);
  return response.data;
};

export type { Categoria };