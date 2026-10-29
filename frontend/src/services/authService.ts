const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/';

export interface AuthData {
  access: string;
  refresh: string;
  username: string;
  rol: 'admin' | 'worker';
}

const KEY = 'auth';

export async function login(username: string, password: string, rolEsperado: 'admin' | 'worker'): Promise<AuthData> {
  const res = await fetch(`${API_URL}auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error de autenticación');
  }
  if (rolEsperado === 'admin' && data.rol !== 'admin') {
    throw new Error('Esta cuenta no tiene acceso de Administrador');
  }
  if (rolEsperado === 'worker' && data.rol !== 'worker') {
    throw new Error('Esta cuenta no tiene acceso de Trabajador');
  }
  localStorage.setItem(KEY, JSON.stringify(data));
  return data as AuthData;
}

export function getAuth(): AuthData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getAuth()?.access ?? null;
}

export function logout(): void {
  localStorage.removeItem(KEY);
}
