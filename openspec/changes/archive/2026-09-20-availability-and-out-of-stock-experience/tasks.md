## 1. Señal pública mínima

- [x] 1.1 Actualizar la allowlist/filtro de publicación existente para admitir exclusivamente `Sin_Stock` como nuevo campo operativo público booleano; normalizar su ausencia histórica a `false` y verificar con productos sintéticos que proveedor, modalidad, saldo, costo, movimientos y otros internos siguen excluidos.
- [x] 1.2 Actualizar el workflow/materialización existente para que genere los JSON B2C y B2B con ese único campo nuevo; conservar la separación de catálogos y no agregar `Sin_Stock` a `admin/productos.json`, porque C-06 no lo consume.
- [x] 1.3 Verificar con casos sintéticos B2C/B2B de precios y productos distintos que ningún estado, precio o campo interno cruza de un canal al otro y que el estado publicado refleja el ciclo actual de publicación, sin garantizar bloqueo instantáneo.

## 2. Comportamiento de catálogo y carrito

- [x] 2.1 Incorporar en `shared/app.js` un predicado de disponibilidad y una guarda de agregado reutilizables, y verificar focalmente los casos `Sin_Stock = true`, `false` y saldo físico cero sin derivar disponibilidad de ese saldo.
- [x] 2.2 Renderizar búsqueda, tarjetas y detalle para conservar visible el producto no disponible, mostrar exactamente `Este producto no está disponible.` y no ofrecer agregado; verificar cada superficie con datos sintéticos en B2C y B2B.
- [x] 2.3 Revalidar el carrito restaurado desde sesión y desde QR contra el último catálogo público disponible, conservar identificable un ítem que pasó a no disponible, mostrar exactamente `Este producto no está disponible.` y permitir únicamente revisarlo o eliminarlo; verificar que no se borra ni sustituye automáticamente.
- [x] 2.4 Bloquear tanto el control visible como las funciones de generación/apertura de WhatsApp y QR cuando el carrito contiene un ítem no disponible, y verificar que al eliminarlo se recupera el flujo vigente sin reserva ni cambio de cantidades.

## 3. Pruebas y revisión manual

- [x] 3.1 Añadir o ejecutar pruebas focalizadas con la infraestructura ya disponible, sin introducir test runner ni entorno temporal, que cubran producto disponible/no disponible, saldo cero, restauración de sesión, reconstrucción QR y guardas de WhatsApp/QR con datos sintéticos.
- [x] 3.2 Realizar revisión manual útil en desktop y mobile para B2C y B2B: búsqueda, tarjeta, detalle, carrito restaurado, eliminación/revisión, bloqueo y desbloqueo de WhatsApp/QR; registrar los flujos comprobados y cualquier limitación sin usar datos reales.
