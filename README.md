# 🛍️ Techno Shop - Sistema de Gestión de Inventario & Punto de Venta (POS)

Sistema **Full-Stack** desacoplado para la administración simplificada de inventarios, gestión visual de tallas mediante guía informativa en imagen, cálculo persistente de márgenes comerciales, registro de ventas en tiempo real (POS) y auditoría financiera por períodos mensuales.

---

## 🛠️ Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                         │
│   • Catálogo con Descripción y 2ª Imagen (Guía de Tallas)              │
│   • Control de Stock Simplificado (4 Campos: Producto, Cat, Talla, Cant)│
│   • Visualización de Guía de Tallas mediante Modal/Lightbox             │
│   • Calculadora de Margen Comercial Persistente (+75% / Configurable)  │
│   • Módulo de Venta Interactiva (POS) con Descuento Atómico            │
│   • Dashboard Financiero Mensual [Selector de Períodos + Reinicio]     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON / REST API / CORS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Django REST Framework)                    │
│   • Modelo Producto con Descripción, Talla Directa y Guía de Tallas    │
│   • Servicios de Dominio (StockService & Transacciones Atómicas)       │
│   • Modelo Venta con Preservación Histórica de Precios                  │
│   • Endpoints de Métricas Financieras Mensuales (Sum / F Expressions)   │
│   • Bloqueo Pesimista (select_for_update) contra sobreventa            │
│   • Endpoint Atómico para Reinicio Seguro de Períodos                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           BASE DE DATOS                                │
│                       SQLite / PostgreSQL                              │
└────────────────────────────────────────────────────────────────────────┘
```

### **Especificaciones Técnicas:**
* **Backend:** Django REST Framework, Python 3.10+, SQLite/PostgreSQL, Servicios de Dominio (`StockService`).
* **Frontend:** React 19, TypeScript 5+, Tailwind CSS, Vite, Lucide Icons.
* **Pruebas Automatizadas:** 17/17 Tests Unitarios Backend Pasados (100% OK).
* **Compilador TypeScript:** 0 errores (`npx tsc -b`).

---

## 📊 Estructura del Control de Stock por Categorías

Dentro de la vista de inventario, el acordeón desplegable por categoría muestra las siguientes 8 columnas:

1. **Producto & Guía:** Miniaturas de la foto del producto y de la **Guía de Tallas** (con Lightbox ampliado al hacer clic).
2. **Ubicación:** Ubicación física en almacén (Posición - Fila, ej. `B-3`).
3. **Talla:** Talla de la prenda (ej. `S`, `M`, `L`, `XL`, `40`).
4. **Precio Recibido (Costo):** Valor a precio de adquisición.
5. **Precio Comercial (Venta):** Precio de venta al público calculado automáticamente (+75% margen configurable y persistente).
6. **Stock Disponible:** Cantidad actual en existencias.
7. **Ajuste Rápido:** Botones `+1` / `-1` para actualización inmediata.
8. **Acciones:** Botón de **🛒 Vender** (descuenta automáticamente el Stock Disponible) y **🗑️ Eliminar**.

---

## 📈 Dashboard y Métricas Financieras Dinámicas (`/api/stock/dashboard-metrics/?mes=8&anio=2026`)

El Panel de Control calcula dinámicamente según el mes y año seleccionados los indicadores financieros clave en la base de datos con `Sum()` y `F()`:

* **Total Ventas ($):** Suma acumulada de las ventas cobradas en el período.
* **Total Stock Vendido (uds):** Cantidad acumulada de unidades despachadas en el período.
* **Total Precio Recibido ($):** Valoración total a costo de adquisición de las unidades vendidas en el período.
* **Total Precio Comercial ($):** Valoración total comercial de las unidades vendidas en el período.
* **Unidades Disponibles (uds):** Cantidad total de mercancía lista para venta actualmente en almacén.

```json
{
  "periodo": {
    "mes": 8,
    "anio": 2026,
    "nombre_mes": "Agosto 2026"
  },
  "total_ventas": 2400000.00,
  "total_stock_vendido": 48,
  "total_precio_recibido": 1800000.00,
  "total_precio_comercial": 2400000.00,
  "total_unidades_disponibles": 15
}
```

---

## 📡 Endpoints de la API REST

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` / `POST` | `/api/categorias/` | Listado y creación rápida de categorías. |
| `GET` / `PUT` / `DELETE` | `/api/categorias/<id>/` | Detalle, edición y baja de categorías. |
| `GET` / `POST` | `/api/productos/` | Alta de productos con fotos (`imagen` e `imagen_guia_tallas`), `descripcion`, `talla` y costo. |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/api/productos/<id>/` | Detalle, actualización y eliminación de productos con imágenes multipart. |
| `GET` / `POST` | `/api/tallas/` | Listado y registro de tallas. |
| `GET` / `POST` | `/api/stock/` | Consulta general de stock e ingreso directo (4 campos) con selector de categoría y margen persistente. |
| `PATCH` / `DELETE` | `/api/stock/<id>/` | Ajustes rápidos (+1/-1) o modificación de margen/stock/categoría. |
| `GET` | `/api/stock/dashboard-metrics/` | Resumen financiero por mes/año (`?mes=8&anio=2026`). |
| `GET` | `/api/stock/meses-disponibles/` | Lista de períodos históricos con ventas registradas. |
| `POST` | `/api/stock/reiniciar-mes/` | Reinicia/elimina las ventas de un período (`{"mes": 8, "anio": 2026}`). |
| `GET` / `POST` | `/api/ventas/` | Histórico y procesamiento de ventas con descuento atómico. |

---

## 🚀 Comandos para Ejecución Local

### **1. Backend (Django API - Puerto 8001)**
```powershell
cd tienda_virtual\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver 8001
```
> **API REST:** `http://127.0.0.1:8001/api/`  
> **Django Admin:** `http://127.0.0.1:8001/admin/`

---

### **2. Frontend (React + TypeScript + Vite - Puerto 5173)**
```powershell
cd frontend
npm run dev
```
> **Web App:** `http://localhost:5173/`

---

### **3. Ejecutar Pruebas Automatizadas**
```powershell
cd tienda_virtual\backend
.\venv\Scripts\python.exe manage.py test stock
```
> **Resultado:** `Ran 17 tests in 0.271s ... OK (100% aprobados)`
