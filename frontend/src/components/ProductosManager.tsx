import { useState, useEffect } from 'react';
import { stockService } from '../services/stockService';
import type { Producto, Categoria } from '../types';
import { UbicacionBadge, formatearUbicacion } from '../utils/locationFormatter';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Store, 
  RefreshCw, 
  Image as ImageIcon, 
  Upload, 
  X,
  Tag,
  Coins,
  FileText,
  Shirt,
  Maximize2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

export const ProductosManager = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null);

  // Form state
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [talla, setTalla] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [precioRecibido, setPrecioRecibido] = useState('');
  const [posicion, setPosicion] = useState('');
  const [fila, setFila] = useState('');
  
  // Imagen principal
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);

  // 2ª Imagen: Guía de tallas
  const [imagenGuiaFile, setImagenGuiaFile] = useState<File | null>(null);
  const [imagenGuiaPreview, setImagenGuiaPreview] = useState<string | null>(null);

  // Lightbox modal para ver imagen ampliada
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        stockService.getProductos(),
        stockService.getCategorias(),
      ]);
      setProductos(prods);
      setCategorias(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const productosFiltrados = productos.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const nombre = (p.nombre || '').toLowerCase();
    const desc = (p.descripcion || '').toLowerCase();
    const talla = (p.talla || '').toLowerCase();
    const cat = (p.categoria?.nombre || '').toLowerCase();
    const pos = (p.posicion || '').toLowerCase();
    const fStr = (p.fila !== undefined && p.fila !== null ? String(p.fila) : '').toLowerCase();
    const ubicacion = formatearUbicacion(p.posicion, p.fila).toLowerCase();

    return (
      nombre.includes(q) ||
      desc.includes(q) ||
      talla.includes(q) ||
      cat.includes(q) ||
      pos.includes(q) ||
      fStr.includes(q) ||
      ubicacion.includes(q)
    );
  });

  // Paginación estricta de 6 productos por página
  const ITEMS_PER_PAGE = 6;
  const [paginaActual, setPaginaActual] = useState(1);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / ITEMS_PER_PAGE));
  const indiceInicio = (paginaActual - 1) * ITEMS_PER_PAGE;
  const productosPaginados = productosFiltrados.slice(indiceInicio, indiceInicio + ITEMS_PER_PAGE);

  const formatearUrlImagen = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagenPreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setImagenFile(null);
    if (imagenPreview && !imagenPreview.startsWith('http')) {
      URL.revokeObjectURL(imagenPreview);
    }
    setImagenPreview(null);
  };

  const handleImageGuiaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenGuiaFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagenGuiaPreview(previewUrl);
    }
  };

  const handleRemoveImageGuia = () => {
    setImagenGuiaFile(null);
    if (imagenGuiaPreview && !imagenGuiaPreview.startsWith('http')) {
      URL.revokeObjectURL(imagenGuiaPreview);
    }
    setImagenGuiaPreview(null);
  };

  const handleOpenCrearModal = () => {
    setProductoEnEdicion(null);
    setNombre('');
    setDescripcion('');
    setTalla('');
    setCategoriaId('');
    setPrecioRecibido('');
    setPosicion('');
    setFila('');
    handleRemoveImage();
    handleRemoveImageGuia();
    setShowModal(true);
  };

  const handleOpenEditarModal = (prod: Producto) => {
    setProductoEnEdicion(prod);
    setNombre(prod.nombre);
    setDescripcion(prod.descripcion || '');
    setTalla(prod.talla || '');
    setCategoriaId(prod.categoria?.id || prod.categoria_id || '');
    setPrecioRecibido(String(prod.precio_recibido || prod.precio || ''));
    setPosicion(prod.posicion || '');
    setFila(prod.fila ? String(prod.fila) : '');
    handleRemoveImage();
    handleRemoveImageGuia();
    if (prod.imagen) {
      setImagenPreview(formatearUrlImagen(prod.imagen));
    }
    if (prod.imagen_guia_tallas) {
      setImagenGuiaPreview(formatearUrlImagen(prod.imagen_guia_tallas));
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setProductoEnEdicion(null);
    setNombre('');
    setDescripcion('');
    setTalla('');
    setCategoriaId('');
    setPrecioRecibido('');
    setPosicion('');
    setFila('');
    handleRemoveImage();
    handleRemoveImageGuia();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !precioRecibido) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('nombre', nombre.trim());
      formData.append('descripcion', descripcion.trim());
      formData.append('talla', talla.trim());
      if (categoriaId) {
        formData.append('categoria_id', String(categoriaId));
      }
      formData.append('precio_recibido', String(precioRecibido));
      formData.append('precio', String(precioRecibido));
      formData.append('posicion', posicion ? posicion.trim().toUpperCase() : '');
      formData.append('fila', fila ? fila.trim() : '');
      formData.append('activo', 'true');

      if (imagenFile) {
        formData.append('imagen', imagenFile);
      }
      if (imagenGuiaFile) {
        formData.append('imagen_guia_tallas', imagenGuiaFile);
      }

      if (productoEnEdicion) {
        await stockService.updateProductoWithImage(productoEnEdicion.id, formData);
      } else {
        await stockService.createProductoWithImage(formData);
      }

      handleCloseModal();
      cargarDatos();
    } catch (e) {
      console.error(e);
      alert('Error al guardar el producto. Revisa los datos ingresados.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Deseas eliminar este producto del catálogo?')) return;
    try {
      await stockService.deleteProducto(id);
      cargarDatos();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Store className="text-indigo-400 shrink-0" size={24} /> <span>Catálogo de Productos</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Administra prendas, descripción, tallas, fotos principales, guías de medidas y costos
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={cargarDatos}
            className="p-2 sm:p-2.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
            title="Recargar productos"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
          </button>
          <button
            onClick={handleOpenCrearModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 cursor-pointer text-xs sm:text-sm"
          >
            <Plus size={18} /> <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR PRODUCTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Store size={20} className="text-indigo-400 shrink-0" />
                <span>{productoEnEdicion ? 'Editar Producto' : 'Registrar Nuevo Producto'}</span>
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* DOS CONTENEDORES DE IMAGEN: FOTO DEL PRODUCTO Y GUÍA DE TALLAS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* 1. FOTO PRINCIPAL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <ImageIcon size={14} className="text-indigo-400" /> Foto del Producto
                  </label>
                  {imagenPreview ? (
                    <div className="relative w-full h-32 sm:h-36 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group">
                      <img src={imagenPreview} alt="Foto Preview" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-lg shadow-lg hover:bg-rose-500 transition cursor-pointer"
                        title="Eliminar foto"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition group h-32 sm:h-36">
                      <div className="p-2 sm:p-2.5 bg-slate-800 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-400 rounded-full transition mb-1">
                        <Upload size={18} />
                      </div>
                      <span className="text-xs font-medium text-slate-300">Subir foto de producto</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WEBP</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* 2. IMAGEN GUÍA DE TALLAS */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Shirt size={14} className="text-cyan-400" /> 2ª Imagen: Guía de Tallas
                  </label>
                  {imagenGuiaPreview ? (
                    <div className="relative w-full h-32 sm:h-36 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center group">
                      <img src={imagenGuiaPreview} alt="Guía Preview" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={handleRemoveImageGuia}
                        className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-lg shadow-lg hover:bg-rose-500 transition cursor-pointer"
                        title="Eliminar guía de tallas"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-800 hover:border-cyan-500/60 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition group h-32 sm:h-36">
                      <div className="p-2 sm:p-2.5 bg-slate-800 group-hover:bg-cyan-600/20 text-slate-400 group-hover:text-cyan-400 rounded-full transition mb-1">
                        <Upload size={18} />
                      </div>
                      <span className="text-xs font-medium text-slate-300">Subir Guía de Tallas</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Tabla de medidas / Ilustración</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageGuiaChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* NOMBRE Y TALLA DEL PRODUCTO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Camisa Oversize Blanca"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-cyan-400 mb-1 flex items-center gap-1">
                    <Shirt size={13} /> Talla del Producto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: M, L, XL, 40"
                    value={talla}
                    onChange={(e) => setTalla(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-slate-100 font-mono font-bold placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* DESCRIPCIÓN DEL PRODUCTO */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <FileText size={13} className="text-indigo-400" /> Descripción del Producto
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el material, corte, temporada, instrucciones de cuidado..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* CATEGORÍA Y COSTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
                    <Coins size={13} /> Precio Recibido (Costo)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Ej: 100.00 (Costo de adquisición)"
                    value={precioRecibido}
                    onChange={(e) => setPrecioRecibido(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* POSICIÓN Y FILA (MULTI-UBICACIÓN) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Posición (Estante)
                    </label>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      Múltiples permitidos
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: A, B o A-B para múltiples estantes"
                    value={posicion}
                    onChange={(e) => setPosicion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span className="text-indigo-400">💡</span> Ej: A, B o A-B para múltiples estantes
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Fila
                    </label>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      Múltiples permitidas
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: 1, 2 o 1-2 para múltiples filas"
                    value={fila}
                    onChange={(e) => setFila(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span className="text-indigo-400">💡</span> Ej: 1, 2 o 1-2 para múltiples filas
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl font-medium transition cursor-pointer text-xs sm:text-sm text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer text-xs sm:text-sm"
                >
                  {submitting ? 'Guardando...' : productoEnEdicion ? 'Actualizar Producto' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARRA DE BÚSQUEDA Y FILTRO */}
      <div className="bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, categoría, talla, estante (ej: A, B) o fila (ej: 1, 2)..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="px-3 py-1.5 sm:py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Limpiar filtro
            </button>
          )}
          <div className="text-[11px] sm:text-xs text-slate-400 font-mono">
            Mostrando <span className="text-indigo-400 font-bold">{productosFiltrados.length}</span> de {productos.length}
          </div>
        </div>
      </div>

      {/* TABLA DEL CATÁLOGO DE PRODUCTOS */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto shadow-xl">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase bg-slate-950/60">
              <th className="p-3 sm:p-4">Fotos (Producto & Guía)</th>
              <th className="p-3 sm:p-4">Producto & Descripción</th>
              <th className="p-3 sm:p-4 text-center">Talla</th>
              <th className="p-3 sm:p-4">Categoría</th>
              <th className="p-3 sm:p-4">Ubicación</th>
              <th className="p-3 sm:p-4">Precio Recibido (Costo)</th>
              <th className="p-3 sm:p-4">Precio Comercial (+75%)</th>
              <th className="p-3 sm:p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
            {productosFiltrados.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  {busqueda ? 'No se encontraron productos que coincidan con la búsqueda.' : 'No hay productos registrados en el catálogo. Haz clic en "Nuevo Producto".'}
                </td>
              </tr>
            )}
            {productosPaginados.map((p) => {
              const imgUrl = formatearUrlImagen(p.imagen);
              const imgGuiaUrl = formatearUrlImagen(p.imagen_guia_tallas);
              const costoUnitario = Number(p.precio_recibido || p.precio || 0);
              const precioVenta = Number(p.precio_comercial || costoUnitario * 1.75);

              return (
                <tr key={p.id} className="hover:bg-slate-800/30 transition">
                  {/* FOTOS: FOTO DEL PRODUCTO + MINIATURA DE GUÍA DE TALLAS */}
                  <td className="p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      {/* Foto del Producto */}
                      {imgUrl ? (
                        <div 
                          onClick={() => setLightboxImage({ url: imgUrl, title: `Foto: ${p.nombre}` })}
                          className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-sm cursor-pointer group shrink-0"
                          title="Clic para ampliar foto"
                        >
                          <img
                            src={imgUrl}
                            alt={p.nombre}
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Maximize2 size={13} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-slate-500 shrink-0">
                          <ImageIcon size={18} />
                        </div>
                      )}

                      {/* Guía de Tallas */}
                      {imgGuiaUrl ? (
                        <div 
                          onClick={() => setLightboxImage({ url: imgGuiaUrl, title: `Guía de Tallas: ${p.nombre}` })}
                          className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950 shadow-sm cursor-pointer group shrink-0"
                          title="Clic para ampliar Guía de Tallas"
                        >
                          <img
                            src={imgGuiaUrl}
                            alt={`Guía ${p.nombre}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-cyan-950/80 text-[9px] font-bold text-cyan-300 text-center py-0.5">
                            GUÍA
                          </div>
                          <div className="absolute inset-0 bg-cyan-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Maximize2 size={13} className="text-cyan-200" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-[10px] shrink-0" title="Sin guía de tallas">
                          -
                        </div>
                      )}
                    </div>
                  </td>

                  {/* NOMBRE DEL PRODUCTO & DESCRIPCIÓN */}
                  <td className="p-3 sm:p-4 max-w-xs">
                    <div>
                      <div className="font-semibold text-slate-100 text-sm sm:text-base">{p.nombre}</div>
                      {p.descripcion && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {p.descripcion}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono mt-1">
                        Código: #{p.id}
                      </div>
                    </div>
                  </td>

                  {/* TALLA */}
                  <td className="p-3 sm:p-4 text-center">
                    {p.talla ? (
                      <span className="inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono font-bold rounded-lg text-xs">
                        {p.talla}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Sin talla</span>
                    )}
                  </td>

                  {/* CATEGORÍA */}
                  <td className="p-3 sm:p-4">
                    {p.categoria?.nombre ? (
                      <span className="inline-flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg text-xs text-slate-300 border border-slate-700/40">
                        <Tag size={11} className="text-indigo-400" /> {p.categoria.nombre}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Sin categoría</span>
                    )}
                  </td>

                  {/* UBICACIÓN EN ALMACÉN */}
                  <td className="p-3 sm:p-4">
                    <UbicacionBadge posicion={p.posicion} fila={p.fila} />
                  </td>

                  {/* PRECIO RECIBIDO (COSTO) */}
                  <td className="p-3 sm:p-4">
                    <span className="font-bold font-mono text-amber-400 text-sm sm:text-base">
                      ${costoUnitario.toLocaleString()}
                    </span>
                  </td>

                  {/* PRECIO COMERCIAL */}
                  <td className="p-3 sm:p-4">
                    <span className="font-bold font-mono text-emerald-400 text-sm sm:text-base">
                      ${precioVenta.toLocaleString()}
                    </span>
                  </td>

                  {/* ACCIONES */}
                  <td className="p-3 sm:p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                      <button
                        onClick={() => handleOpenEditarModal(p)}
                        className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition cursor-pointer"
                        title="Editar producto"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                        title="Eliminar producto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CONTROLES DE PAGINACIÓN (ESTRICTAMENTE 6 PRODUCTOS POR PÁGINA) */}
      {productosFiltrados.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-lg">
          <div className="text-xs text-slate-400 font-medium text-center sm:text-left">
            Mostrando <span className="font-bold text-slate-200">{indiceInicio + 1}</span> al{' '}
            <span className="font-bold text-slate-200">
              {Math.min(indiceInicio + ITEMS_PER_PAGE, productosFiltrados.length)}
            </span>{' '}
            de <span className="font-bold text-indigo-400">{productosFiltrados.length}</span> productos
            <span className="text-slate-600 mx-2 hidden sm:inline">|</span>
            <span className="block sm:inline mt-0.5 sm:mt-0">
              Página <span className="font-bold text-slate-200">{paginaActual}</span> de{' '}
              <span className="font-bold text-slate-200">{totalPaginas}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setPaginaActual(1)}
              disabled={paginaActual === 1}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              title="Primera página"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
              disabled={paginaActual === 1}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((num) => {
                  return (
                    num === 1 ||
                    num === totalPaginas ||
                    Math.abs(num - paginaActual) <= 1
                  );
                })
                .map((num, idx, arr) => {
                  const prevNum = arr[idx - 1];
                  const showEllipsis = prevNum && num - prevNum > 1;
                  return (
                    <div key={num} className="flex items-center gap-1">
                      {showEllipsis && <span className="text-slate-600 px-1 text-xs">...</span>}
                      <button
                        type="button"
                        onClick={() => setPaginaActual(num)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                          paginaActual === num
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))}
              disabled={paginaActual === totalPaginas}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              title="Página siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPaginaActual(totalPaginas)}
              disabled={paginaActual === totalPaginas}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              title="Última página"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL / LIGHTBOX PARA VER IMAGEN O GUÍA DE TALLAS AMPLIADA */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 cursor-zoom-out animate-fadeIn overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-3 sm:p-4 flex flex-col items-center cursor-default"
          >
            <div className="w-full flex items-center justify-between pb-2.5 sm:pb-3 mb-2 border-b border-slate-800">
              <h4 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2 truncate pr-2">
                <Shirt size={16} className="text-cyan-400 shrink-0" /> <span className="truncate">{lightboxImage.title}</span>
              </h4>
              <button
                onClick={() => setLightboxImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-h-[70vh] sm:max-h-[75vh] w-auto max-w-full object-contain rounded-xl border border-slate-800 shadow-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const ProductManager = ProductosManager;
