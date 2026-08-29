# Auditoría de Migración y Prompt Maestro: De "Piel Divina" a "Pollo Sabroso"

## 1. Auditoría de Componentes Reutilizables (Qué rescatar)

Tras analizar el repositorio de retail actual, estos son los módulos que funcionan excelentemente y deben ser trasladados al nuevo sistema:

*   **Infraestructura Base de Datos y Auth:** La inicialización dual de Firebase en `services/firebase.ts` (App principal y SecondaryApp para crear usuarios sin desloguear al admin). El contexto de autenticación en `context/AuthContext.tsx` escuchando `onAuthStateChanged` y cruzando con la colección `users` en Firestore.
*   **Impresión Térmica Híbrida (Web/Móvil):** La lógica contenida en `utils/printReceipt.ts`, específicamente el generador de HTML en línea estructurado para 80mm (`@page { size: 80mm auto; }`) y el ingenioso fallback para Android usando `window.open` y su auto-cierre (`printWindow.onafterprint`), así como el `iframe` oculto para Desktop.
*   **Gestión de Formularios y Loaders:** El manejo resiliente de estados locales (`isLoading`, `isSubmitting`) usando bloques `try...finally` combinados con Toast Context para feedback de errores de UI.
*   **Ecosistema Vite + Tailwind:** Toda la configuración base del proyecto en `package.json`, `vite.config.ts`, y `eslint.config.js`.

## 2. Filtro de Deuda Técnica (Qué descartar permanentemente)

Para asegurar que "Pollo Sabroso" sea ultrarrápido y no arrastre complejidad innecesaria de un retail/cosmético, **SE PROHÍBE ESTRICTAMENTE** incluir lo siguiente en el nuevo proyecto:

*   **No Kardex ni auditoría contable de stock por ingredientes:** Eliminar colecciones `kardex_logs`, `transfers`, `stores` (bodegas). Todo será de venta directa.
*   **No atributos complejos de retail:** Eliminar campos como `capacity`, `gender`, `categoryType`, `barcode`, `wholesalePrice`.
*   **No sincronizaciones de catálogo público:** Descartar lógicas como `syncToPublicCatalog`, tablas paralelas como `public_catalog` o inventarios diferidos.
*   **No UI de Catálogo Pesado:** Eliminar las listas con imágenes pesadas en el POS. El POS táctil debe basarse en botones y texto (tipografía grande), sin requerir scroll infinito.
*   **No buscadores de texto ni lector de código de barras:** La interfaz POS se navega por pestañas y toques, no escribiendo.

---

## 3. PROMPT MAESTRO DEFINITIVO PARA EL NUEVO REPOSITORIO

*(Copia y pega este prompt exactamente como está en una nueva conversación o agente para inicializar el proyecto "Pollo Sabroso")*

```text
Actúa como un arquitecto de software y desarrollador Full Stack senior especializado en sistemas POS táctiles de alto rendimiento.

Vas a inicializar un nuevo proyecto desde cero llamado "Pollo Sabroso", un sistema de punto de venta (POS) para un restaurante de comida rápida (pollería). Utilizaremos Vite (React + TypeScript) y Firebase (Auth, Firestore, Cloud Functions).

### 1. Requisitos de la Interfaz (POS Táctil de Comida Rápida)
El diseño del POS debe ser radicalmente distinto a un e-commerce. Necesito una UI especializada, orientada 100% al uso táctil rápido en mostradores:
- **Navegación:** Pestañas fijas superiores o laterales grandes (Broaster, Espiedo, Bebidas, Extras).
- **Interacción de 1 Toque:** Cuadrículas (Grids) con botones enormes por plato (Económico, Cuarto, Medio, Entero). Sin imágenes pesadas, usar iconos lucide-react o puro texto claro. NO BUSCADORES DE TEXTO.
- **Modificadores Obligatorios (Pop-ups rápidos):** Al tocar un plato (ej. "Cuarto Broaster"), debe saltar un modal instantáneo, centrado y grande exigiendo elegir:
  - *Guarnición:* (Chaufa, Blanco, Mixto, Solo papas)
  - *Presa:* (Pecho, Pierna)
  El producto no va a la comanda/carrito hasta no completar estos modificadores.

### 2. Gestión de Stock Híbrida
- **Platos Preparados (Pollo/Porciones):** Menú abierto. Solo tienen un switch `disponible: true/false`. No tienen stock numérico.
- **Bebidas/Extras (Gaseosas):** Stock numérico tradicional. Descuentan `1` por unidad vendida. Si el contador llega a `0`, el botón en el POS se bloquea visualmente y no deja agregarlo.

### 3. Esquema de Base de Datos (Firestore)
Diseña los modelos TS y las funciones para estas colecciones:
- `platos`: { id, nombre, precio, tipo (preparado/bebida), disponible (boolean), stock (number, opcional), categoria (Broaster, Espiedo...) }
- `ordenes`: { id, numeroTurno (contador diario #001), estado (PENDIENTE, PAGADA, ANULADA), items (incluyendo guarnición/presa elegida), total, metodoPago, fecha }
- `config_turno`: Un documento único para gestionar el número secuencial correlativo diario de las órdenes (ej. ticket #045).
- `pagos_qr`: Historial temporal para enlazar transacciones.

### 4. Flujo de Pago QR Automatizado
Implementaremos un cobro asistido por webhook:
- Crea una Firebase Cloud Function (HTTP Endpoint) o configura un webhook serverless que reciba un `POST` desde un celular Android externo (Tasker/MacroDroid) cuando llegue una notificación de pago del banco.
- Ese Webhook actualizará el documento en la colección `ordenes` correspondiente a estado `PAGADA`.
- El cliente (POS frontend) estará escuchando activamente ese documento específico mediante **`onSnapshot`** de Firestore. En cuanto detecte que el estado cambia a `PAGADA`, el frontend cerrará la venta automáticamente y disparará la impresión térmica.

### 5. Impresión Térmica
Reutiliza la lógica de impresión en un archivo `utils/printReceipt.ts`. El formato es HTML inyectado optimizado para papel de 80mm:
- Configuración CSS: `@page { size: 80mm auto; margin: 0; }` y `body { font-family: monospace; }`.
- Para Desktop: Usa un iframe oculto.
- Para Móvil (Android): Usa `const printWindow = window.open('', '_blank');` seguido del HTML, disparando `printWindow.print();` y auto-cerrando con `printWindow.onafterprint = () => printWindow.close();`.
- El ticket impreso DEBE incluir en tamaño MUY GRANDE el Número de Turno (`#001`), la fecha, si es para Llevar o Salón, y el detalle con los modificadores (ej. "1x Cuarto Broaster [Chaufa, Pecho]").

### 6. Estructura de Carpetas Recomendada
```
src/
├── components/
│   ├── pos/            (Botones táctiles, Modal Modificadores)
│   ├── layout/         (Tabs de Categorías, Resumen de Orden)
│   └── shared/         (Modales, Toasts genéricos)
├── context/            (AuthContext, PosContext)
├── types/              (Modelos Plato, Orden, Modificador)
├── services/
│   ├── firebase.ts     (App principal y Secondary Auth)
│   └── db.ts           (Funciones Firestore con onSnapshot para Ordenes)
├── utils/
│   └── printReceipt.ts (Lógica térmica híbrida 80mm rescatada)
├── pages/              (POS, Historial, Inventario Bebidas)
└── App.tsx
```

Inicializa el proyecto con esta estructura, la configuración de Tailwind v4 y Vite, y crea los componentes base del POS táctil y los modelos de Firestore descritos.
```
