import { useEffect, useState } from 'react';
import {
    obtenerProductos,
    type Producto
} from '../../services/productoService';
import { formatearUbicacion } from '../../utils/locationFormatter';

import './Productos.css';

function Productos() {

    const [productos, setProductos] = useState<Producto[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {

        const cargarProductos = async () => {

            try {

                const datos = await obtenerProductos();

                setProductos(datos);

            } catch (error) {

                console.error(
                    'ERROR COMPLETO:',
                    error
                );

                setError(
                    'No se pudieron cargar los productos.'
                );

            } finally {

                setCargando(false);

            }
        };

        cargarProductos();

    }, []);

    if (cargando) {
        return <p>Cargando productos...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div className="productos">

            <h1>Productos</h1>

            <div className="productos-lista">

                {productos.map((producto) => (

                    <div
                        className="producto-card"
                        key={producto.id}
                    >

                        {producto.imagen && (
                            <img
                                src={`${producto.imagen}`}
                                alt={producto.nombre}
                            />
                        )}

                        <h2>
                            {producto.nombre}
                        </h2>

                        <p>
                            Precio: $
                            {producto.precio}
                        </p>

                        <p>
                            Categoría:{' '}
                            {producto.categoria?.nombre ?? 'Sin categoría'}
                        </p>

                        <p>
                            Ubicación:{' '}
                            {formatearUbicacion(producto.posicion, producto.fila)}
                        </p>

                        <p>
                            Stock total:{' '}
                            {producto.stock_total}
                        </p>

                        <p>
                            Estado:{' '}
                            {producto.activo
                                ? 'Activo'
                                : 'Inactivo'}
                        </p>

                    </div>

                ))}

            </div>

        </div>
    );
}

export default Productos;
