import { useState, useEffect } from 'react';
import { stockService } from '../services/stockService';
import type { Categoria } from '../types';
import { Plus, Trash2, FolderTree, RefreshCw, Pencil, X } from 'lucide-react';

export const CategoriasManager = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarCategorias = async () => {
    setLoading(true);
    try {
      const data = await stockService.getCategorias();
      setCategorias(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) return;
    try {
      if (categoriaEditando) {
        await stockService.updateCategoria(categoriaEditando.id, { 
          nombre: nombre.trim(), 
          descripcion: descripcion.trim() 
        });
      } else {
        await stockService.createCategoria({ 
          nombre: nombre.trim(), 
          descripcion: descripcion.trim() 
        });
      }
      setNombre('');
      setDescripcion('');
      setCategoriaEditando(null);
      cargarCategorias();
    } catch (e: any) {
      console.error(e);
      if (e.response?.data?.nombre) {
        setError(e.response.data.nombre[0]);
      } else {
        setError('Error al guardar la categoría. Puede que ya exista.');
      }
    }
  };

  const handleEdit = (cat: Categoria) => {
    setCategoriaEditando(cat);
    setNombre(cat.nombre);
    setDescripcion(cat.descripcion || '');
    setError(null);
  };

  const handleCancelEdit = () => {
    setCategoriaEditando(null);
    setNombre('');
    setDescripcion('');
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Deseas eliminar esta categoría?')) return;
    try {
      await stockService.deleteCategoria(id);
      cargarCategorias();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FolderTree className="text-indigo-400" size={24} /> Gestión de Categorías
          </h2>
          <p className="text-sm text-slate-400">Administra las familias de productos</p>
        </div>
        <button 
          onClick={cargarCategorias} 
          className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
          title="Recargar categorías"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Nombre de la categoría (ej: Calzado, Camisetas)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2 w-full md:w-auto">
            <button
              type="submit"
              className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition whitespace-nowrap text-xs sm:text-sm shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {categoriaEditando ? <Pencil size={16} /> : <Plus size={16} />}
              {categoriaEditando ? 'Guardar' : 'Agregar'}
            </button>
            {categoriaEditando && (
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl transition flex items-center justify-center cursor-pointer text-xs sm:text-sm"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-rose-400 text-xs sm:text-sm">{error}</p>}
      </form>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase bg-slate-950/60">
              <th className="p-3 sm:p-4">ID</th>
              <th className="p-3 sm:p-4">Nombre</th>
              <th className="p-3 sm:p-4">Descripción</th>
              <th className="p-3 sm:p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
            {categorias.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No hay categorías registradas. Agrega una arriba.
                </td>
              </tr>
            )}
            {categorias.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/30 transition">
                <td className="p-3 sm:p-4 text-slate-500 font-mono">#{c.id}</td>
                <td className="p-3 sm:p-4 font-medium text-slate-200">{c.nombre}</td>
                <td className="p-3 sm:p-4 text-slate-400">{c.descripcion || '-'}</td>
                <td className="p-3 sm:p-4 text-right">
                  <div className="flex justify-end gap-1.5 sm:gap-2">
                    <button 
                      onClick={() => handleEdit(c)} 
                      className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                      title="Editar categoría"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(c.id)} 
                      className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Eliminar categoría"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
