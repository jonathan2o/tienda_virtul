import { useEffect, useState } from 'react';

import {
    obtenerStockPorUbicacion,
    crearStock,
    type StockUbicacionResponse
} from '../../services/stockService';

import {
    obtenerTallas
} from '../../services/tallaService';
import type { Talla } from '../../types';

import './Inventario.css';


function Inventario() {

    const [posicion, setPosicion] = useState('');
    const [fila, setFila] = useState('');

    const [resultado, setResultado] =
        useState<StockUbicacionResponse | null>(null);

    const [tallas, setTallas] =
        useState<Talla[]>([]);

    const [productoSeleccionado, setProductoSeleccionado] =
        useState<number | null>(null);

    const [tallaSeleccionada, setTallaSeleccionada] =
        useState('');

    const [cantidad, setCantidad] =
        useState('');

    const [cargando, setCargando] =
        useState(false);

    const [error, setError] =
        useState('');


    /*
    ==========================================
    CARGAR TALLAS
    ==========================================
    */

    useEffect(() => {

        const cargarTallas = async () => {

            try {

                const datos = await obtenerTallas();

                setTallas(datos);

            } catch (error) {

                console.error(
                    'ERROR CARGANDO TALLAS:',
                    error
                );

                setError(
                    'No se pudieron cargar las tallas.'
                );

            }

        };

        cargarTallas();

    }, []);


    /*
    ==========================================
    BUSCAR UBICACIÓN
    ==========================================
    */

    const buscarUbicacion = async () => {

        if (!posicion.trim() || !fila.trim()) {

            setError(
                'Ingresa posición y fila.'
            );

            return;
        }

        try {

            setCargando(true);

            setError('');

            const datos =
                await obtenerStockPorUbicacion(
                    posicion.trim().toUpperCase(),
                    Number(fila)
                );

            setResultado(datos);

        } catch (error) {

            console.error(
                'ERROR BUSCANDO UBICACIÓN:',
                error
            );

            setError(
                'No se pudo consultar la ubicación.'
            );

            setResultado(null);

        } finally {

            setCargando(false);

        }
    };


    /*
    ==========================================
    AGREGAR STOCK
    ==========================================
    */

    const agregarStock = async () => {

        if (
            productoSeleccionado === null ||
            !tallaSeleccionada ||
            !cantidad
        ) {

            setError(
                'Completa producto, talla y cantidad.'
            );

            return;
        }

        const cantidadNumerica =
            Number(cantidad);

        if (cantidadNumerica <= 0) {

            setError(
                'La cantidad debe ser mayor que 0.'
            );

            return;
        }

        try {

            setError('');

            await crearStock({

                producto_id:
                    productoSeleccionado,

                talla:
                    tallas.find((t) => t.id === Number(tallaSeleccionada))?.nombre || tallaSeleccionada,

                cantidad:
                    cantidadNumerica

            });

            alert(
                'Stock agregado correctamente.'
            );

            /*
            Limpiar formulario
            */

            setProductoSeleccionado(null);

            setTallaSeleccionada('');

            setCantidad('');


            /*
            Volver a consultar
            la ubicación actual
            */

            await buscarUbicacion();

        } catch (error: any) {

            console.error(
                'ERROR CREANDO STOCK:',
                error
            );

            console.error(
                'RESPUESTA DEL BACKEND:',
                error.response?.data
            );

            setError(
                JSON.stringify(
                    error.response?.data ||
                    'No se pudo agregar el stock.'
                )
            );

        }
    };


    /*
    ==========================================
    RENDER
    ==========================================
    */

    return (

        <div className="inventario">

            <h1>
                Inventario
            </h1>


            {/* ==============================
                BUSCAR UBICACIÓN
            ============================== */}

            <div className="busqueda-ubicacion">

                <div>

                    <label>
                        Posición
                    </label>

                    <input
                        type="text"
                        value={posicion}
                        onChange={(e) =>
                            setPosicion(
                                e.target.value
                            )
                        }
                        placeholder="Ej: B"
                    />

                </div>


                <div>

                    <label>
                        Fila
                    </label>

                    <input
                        type="text"
                        value={fila}
                        onChange={(e) =>
                            setFila(
                                e.target.value
                            )
                        }
                        placeholder="Ej: 1, 2 o 1-2"
                    />

                </div>


                <button
                    onClick={buscarUbicacion}
                    disabled={cargando}
                >

                    {cargando
                        ? 'Buscando...'
                        : 'Buscar'}

                </button>

            </div>


            {/* ==============================
                ERROR
            ============================== */}

            {error && (

                <p className="error">
                    {error}
                </p>

            )}


            {/* ==============================
                RESULTADO
            ============================== */}

            {resultado && (

                <div className="resultado">

                    <h2>
                        Ubicación: {resultado.ubicacion}
                    </h2>


                    {/* ==========================
                        AGREGAR STOCK
                    ========================== */}

                    <div className="form-stock">

                        <h3>
                            Agregar stock
                        </h3>


                        {/* PRODUCTO */}

                        <select
                            value={
                                productoSeleccionado ?? ''
                            }
                            onChange={(e) =>
                                setProductoSeleccionado(
                                    e.target.value
                                        ? Number(
                                            e.target.value
                                        )
                                        : null
                                )
                            }
                        >

                            <option value="">
                                Seleccionar producto
                            </option>

                            {resultado.productos.map(
                                (producto: any) => (

                                    <option
                                        key={producto.id}
                                        value={producto.id}
                                    >
                                        {producto.nombre}
                                    </option>

                                )
                            )}

                        </select>


                        {/* TALLA */}

                        <select
                            value={tallaSeleccionada}
                            onChange={(e) =>
                                setTallaSeleccionada(
                                    e.target.value
                                )
                            }
                        >

                            <option value="">
                                Seleccionar talla recibida
                            </option>

                            {tallas.map(
                                (talla) => (

                                    <option
                                        key={talla.id}
                                        value={talla.id}
                                    >
                                        {talla.nombre}
                                    </option>

                                )
                            )}

                        </select>


                        {/* CANTIDAD */}

                        <input
                            type="number"
                            min="1"
                            value={cantidad}
                            onChange={(e) =>
                                setCantidad(
                                    e.target.value
                                )
                            }
                            placeholder="Cantidad"
                        />


                        {/* BOTÓN */}

                        <button
                            onClick={agregarStock}
                        >
                            Agregar stock
                        </button>

                    </div>


                    {/* ==========================
                        PRODUCTOS
                    ========================== */}

                    {resultado.productos.length === 0 ? (

                        <p>
                            No hay productos en esta
                            ubicación.
                        </p>

                    ) : (

                        <div className="productos-inventario">

                            {resultado.productos.map(
                                (producto: any) => (

                                    <div
                                        className="producto-inventario"
                                        key={producto.id}
                                    >


                                        {/* IMAGEN */}

                                        {producto.imagen && (

                                            <img
                                                src={
                                                    `${producto.imagen}`
                                                }
                                                alt={
                                                    producto.nombre
                                                }
                                            />

                                        )}


                                        {/* INFORMACIÓN */}

                                        <div>

                                            <h3>
                                                {
                                                    producto.nombre
                                                }
                                            </h3>


                                            <p>
                                                Precio: $
                                                {
                                                    producto.precio
                                                }
                                            </p>


                                            <p>
                                                Ubicación:{' '}

                                                {
                                                    producto.ubicacion
                                                }
                                            </p>


                                            <p>
                                                Stock total:{' '}

                                                <strong>
                                                    {
                                                        producto.stock_total
                                                    }
                                                </strong>
                                            </p>


                                            <h4>
                                                Tallas
                                            </h4>


                                            {Object.keys(
                                                producto.tallas
                                            ).length === 0 ? (

                                                <p>
                                                    Sin stock
                                                    registrado
                                                </p>

                                            ) : (

                                                <div className="tallas">

                                                    {Object.entries(
                                                        producto.tallas
                                                    ).map(
                                                        (
                                                            [
                                                                talla,
                                                                cantidad
                                                            ]: [string, any]
                                                        ) => (

                                                            <span
                                                                key={
                                                                    talla
                                                                }
                                                            >
                                                                {talla}:{' '}
                                                                {String(
                                                                    cantidad
                                                                )}
                                                            </span>

                                                        )
                                                    )}

                                                </div>

                                            )}

                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                    )}

                </div>

            )}

        </div>

    );
}


export default Inventario;
