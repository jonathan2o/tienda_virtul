import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { StockManager } from './components/StockManager';
import { ProductosManager } from './components/ProductosManager';
import { CategoriasManager } from './components/CategoriasManager';
import { ChatbotManager } from './components/ChatbotManager';
import { Login } from './components/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getAuth } from './services/authService';

function AppShell() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
      {activeTab === 'stock' && <StockManager />}
      {activeTab === 'productos' && <ProductosManager />}
      {activeTab === 'categorias' && <CategoriasManager />}
      {activeTab === 'chatbot' && <ChatbotManager />}
    </Layout>
  );
}

function App() {
  const auth = getAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin-dashboard" element={<ProtectedRoute rol="admin"><AppShell /></ProtectedRoute>} />
        <Route path="/worker-dashboard" element={<ProtectedRoute rol="worker"><AppShell /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={auth ? (auth.rol === 'admin' ? '/admin-dashboard' : '/worker-dashboard') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
