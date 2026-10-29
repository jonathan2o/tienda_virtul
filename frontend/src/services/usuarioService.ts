import api from './api';

export interface UsuarioItem {
  id: number;
  username: string;
  rol: 'admin' | 'worker';
}

export const usuarioService = {
  getUsuarios: async (rol?: 'admin' | 'worker'): Promise<UsuarioItem[]> => {
    const url = rol ? `usuarios/?rol=${rol}` : 'usuarios/';
    const res = await api.get<UsuarioItem[]>(url);
    return res.data;
  },
  getTrabajadores: async (): Promise<UsuarioItem[]> => {
    return usuarioService.getUsuarios('worker');
  },
};
