import { useEffect, useState } from 'react';
import {
    obtenerCategorias,
    type Categoria
} from '../../services/categoriaService';

function Categorias() {

    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {

        const cargarCategorias = async () => {

            try {

                const data = await obtenerCategorias();

                setCategorias(data);

            } catch (error) {

                console.error('ERROR COMPLETO:', error);

                setError(
                    'No se pudieron cargar las categorías.'
                );
            } finally {

                setCargando(false);

            }
        };

        cargarCategorias();

    }, []);

    if (cargando) {
        return <p>Cargando categorías...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div>

            <h1>Categorías</h1>

            {categorias.map((categoria) => (

                <div key={categoria.id}>

                    <h3>
                        {categoria.nombre}
                    </h3>

                    <p>
                        Descripción:{' '}
                        {categoria.descripcion || 'Sin descripción'}
                    </p>

                </div>

            ))}

        </div>
    );
}

export default Categorias;