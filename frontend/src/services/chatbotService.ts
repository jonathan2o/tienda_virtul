import api from './api';

export interface ConfigBot {
  id: number;
  activo: boolean;
  modo: 'autonomo' | 'revision';
  tono: string;
  reglas_extra: string;
  hora_inicio: string | null;
  hora_fin: string | null;
}

export interface SimuladorResponse {
  conversacion_id: number;
  chat_id: string;
  respuesta: string;
  mostrar_catalogo?: boolean;
  modo: 'autonomo' | 'revision';
  estado_conversacion: string;
}

export const chatbotService = {
  getConfig: () => api.get<ConfigBot>('/chatbot/config/').then((r) => r.data),
  updateConfig: (data: Partial<ConfigBot>) =>
    api.patch<ConfigBot>('/chatbot/config/', data).then((r) => r.data),
  getEstado: () => api.get('/chatbot/estado/').then((r) => r.data),
  getConversaciones: () => api.get('/chatbot/conversaciones/').then((r) => r.data),
  getMensajes: (id: number) => api.get(`/chatbot/conversaciones/${id}/mensajes/`).then((r) => r.data),
  tomarChat: (id: number) => api.post(`/chatbot/conversaciones/${id}/tomar-chat/`).then((r) => r.data),
  responder: (id: number, texto: string) =>
    api.post(`/chatbot/conversaciones/${id}/responder/`, { texto }).then((r) => r.data),
  simular: (chat_id: string, nombre_cliente: string, mensaje: string) =>
    api.post<SimuladorResponse>('/chatbot/simulador/', { chat_id, nombre_cliente, mensaje }).then((r) => r.data),
};
