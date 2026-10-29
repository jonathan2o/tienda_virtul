import api from './api';
import type { Talla } from '../types';

export const obtenerTallas = async (): Promise<Talla[]> => {
  const response = await api.get<Talla[]>('tallas/');
  return response.data;
};

export const crearTalla = async (datos: Partial<Talla>): Promise<Talla> => {
  const response = await api.post<Talla>('tallas/', datos);
  return response.data;
};

export type { Talla };
