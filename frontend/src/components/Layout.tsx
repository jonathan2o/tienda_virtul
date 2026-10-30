import { useState, useEffect, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Boxes,
  FolderTree,
  Bot as BotIcon,
  BookOpen,
  Menu,
  X,
  Store,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { getAuth, logout } from '../services/authService';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout = ({ children, activeTab, setActiveTab }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_collapsed', JSON.stringify(isCollapsed));
    } catch {
      // Ignore local storage write errors
    }
  }, [isCollapsed]);

  const auth = getAuth();
  const esWorker = auth?.rol === 'worker';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock', label: 'Control de Stock', icon: Boxes },
    { id: 'productos', label: 'Productos', icon: Store },
    { id: 'categorias', label: 'Categorías', icon: FolderTree },
    { id: 'chatbot', label: 'Chatbot', icon: BotIcon },
    { id: 'catalogo', label: 'Catálogo', icon: BookOpen },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* NAVBAR SUPERIOR */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* BOTÓN MÓVIL PARA ABRIR DRAWER */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Abrir menú"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* BOTÓN DESKTOP PARA ALTERNAR COLAPSO/EXPANSIÓN DEL SIDEBAR */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer items-center justify-center border border-transparent hover:border-slate-700"
            title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>

          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <Store size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
                Tienda Virtual
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Gestión de Inventario & Stock</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>API Conectada</span>
          </span>

          {auth && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <UserIcon size={14} className={esWorker ? 'text-amber-400' : 'text-indigo-400'} />
                <span className="font-medium text-slate-200">{auth.username}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${esWorker ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                  {esWorker ? 'Trabajador' : 'Admin'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* OVERLAY PARA MÓVIL */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          />
        )}

        {/* SIDEBAR COLAPSABLE */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 
          transition-all duration-300 ease-in-out flex flex-col justify-between shrink-0
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
          ${sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 w-64'}
        `}>
          <div>
            {/* CABECERA INTERNA DEL SIDEBAR (BRANDING & BOTÓN DE ALTERNANCIA) */}
            <div className={`p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center transition-all duration-300 ${isCollapsed ? 'justify-between md:justify-center md:flex-col gap-2' : 'justify-between'}`}>
              <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
                <div 
                  onClick={() => isCollapsed && setIsCollapsed(false)}
                  className={`bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-500/20 shrink-0 ${isCollapsed ? 'cursor-pointer hover:bg-indigo-500 transition hover:scale-105' : ''}`}
                  title={isCollapsed ? 'Clic para expandir barra lateral' : 'Tienda Virtual'}
                >
                  <Store size={20} />
                </div>
                
                <div className={`transition-all duration-300 ${isCollapsed ? 'md:hidden' : 'block'}`}>
                  <h2 className="font-bold text-sm sm:text-base leading-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent whitespace-nowrap">
                    Tienda Virtual
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">Control de Stock & POS</p>
                </div>
              </div>

              {/* BOTÓN EN MÓVIL PARA CERRAR EL DRAWER */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>

              {/* BOTÓN EN DESKTOP PARA ALTERNAR COLAPSAR / EXPANDIR */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`hidden md:flex items-center justify-center p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer border border-transparent hover:border-slate-700 ${isCollapsed ? 'mt-1' : ''}`}
                title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
                aria-label={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            {/* LISTA DE NAVEGACIÓN */}
            <div className={`p-3 space-y-1.5 ${isCollapsed ? 'md:px-2' : 'px-3'}`}>
              <p className={`px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 ${isCollapsed ? 'md:hidden' : 'block'}`}>
                Navegación
              </p>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`
                      w-full flex items-center rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer group relative
                      ${isCollapsed 
                        ? 'gap-3 px-3.5 py-2.5 md:justify-center md:px-0 md:py-3' 
                        : 'gap-3 px-3.5 py-2.5'
                      }
                      ${isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }
                    `}
                  >
                    <Icon 
                      size={20} 
                      className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'} transition-transform duration-200 group-hover:scale-110`} 
                    />
                    
                    {/* ETIQUETA DE TEXTO (OCULTA EN DESKTOP CUANDO ESTÁ COLAPSADO) */}
                    <span className={`truncate text-left ${isCollapsed ? 'md:hidden' : 'block'}`}>
                      {item.label}
                    </span>

                    {/* TOOLTIP FLOTANTE ELEGANTE EN MODO COLAPSADO DESKTOP */}
                    {isCollapsed && (
                      <div className="hidden md:flex absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl shadow-2xl border border-slate-700/80 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 items-center gap-1.5">
                        <span>{item.label}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* FOOTER DEL SIDEBAR */}
          <div className="p-3 sm:p-4 border-t border-slate-800/60">
            <div className={`transition-all duration-300 ${isCollapsed ? 'md:hidden' : 'block'}`}>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
                <p className="font-semibold text-slate-300">Sistema v2.0</p>
                <p className="mt-0.5">Gestión simplificada de tallas activa</p>
              </div>
            </div>

            {isCollapsed && (
              <div 
                className="hidden md:flex w-10 h-10 mx-auto rounded-xl bg-slate-800/60 border border-slate-700/60 items-center justify-center text-slate-400 text-[10px] font-mono font-bold group relative cursor-help"
                title="Sistema v2.0 - Tallas activas"
              >
                <span>v2.0</span>
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs font-medium rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                  Sistema v2.0
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  );
};
