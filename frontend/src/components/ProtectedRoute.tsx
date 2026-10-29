import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getAuth } from '../services/authService';

export const ProtectedRoute = ({ children, rol }: { children: ReactNode; rol: 'admin' | 'worker' }) => {
  const auth = getAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.rol !== rol) {
    return <Navigate to={auth.rol === 'admin' ? '/admin-dashboard' : '/worker-dashboard'} replace />;
  }
  return <>{children}</>;
};
