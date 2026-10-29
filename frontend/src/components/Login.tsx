import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, HardHat, LogIn } from 'lucide-react';
import { login } from '../services/authService';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'admin' | 'worker'>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password, rol);
      navigate(data.rol === 'admin' ? '/admin-dashboard' : '/worker-dashboard');
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white text-center mb-1">Techno Shop</h1>
        <p className="text-slate-400 text-sm text-center mb-6">Inicia sesión en tu cuenta</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRol('admin')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition ${rol === 'admin' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 text-slate-400 hover:border-slate-700'}`}
          >
            <ShieldCheck size={28} />
            <span className="text-sm font-medium">Administrador</span>
          </button>
          <button
            type="button"
            onClick={() => setRol('worker')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition ${rol === 'worker' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 text-slate-400 hover:border-slate-700'}`}
          >
            <HardHat size={28} />
            <span className="text-sm font-medium">Trabajador</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50"
          >
            <LogIn size={18} />
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};
