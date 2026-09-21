## Context

La propuesta (`proposal.md`) depende directamente de C-02, que ya cubre transitivamente C-01: C-01 define el snapshot inmutable por ítem y el hito de descuento; C-02 provee el libro mayor privado, el escritor interno de `VENTA`, unicidad de `Clave_Idempotencia` y `LockService`. La persistencia de pedidos e ítems sigue siendo Google Sheets a través de Apps Script; no hay backend adicional ni inventario público en tiempo real.

## Goals / Non-Goals

**Goals:**

- Convertir sólo la transición efectiva a `Entregado` en el disparador de una venta física por ítem con stock gestionado.
- Preservar snapshots, historial y trazabilidad frente a reintentos, errores posteriores y pedidos mixtos.
- Mantener el flujo compatible con la API administrativa existente y con el sobre de respuesta actual.

**Non-Goals:**

- No crear reservas, conciliación de pagos, backfill, ventas retrospectivas, interfaz de inventario, CRUD de proveedores ni lógica de `Sin_Stock`.
- No cambiar B2C, B2B, catálogo público, despliegue, autorización ni modelo de autenticación.
- No convertir el movimiento `VENTA` en un registro de cobro ni modificar Finanzas.

## Decisions

### 1. La identidad y clasificación se congelan en el ítem, no se consultan al entregar

Cada línea nueva recibirá su `Item_Id` estable una sola vez y, en ese momento, el flujo obtendrá `Id_Proveedor`, `Modalidad_Abastecimiento` y `Gestiona_Stock` desde la clasificación vigente para persistirlos como snapshot. Al re-guardar un pedido pendiente, cada línea existente conserva exactamente esos cuatro valores aunque el catálogo se haya reclasificado; una línea nueva recibe un `Item_Id` y snapshot nuevos. La identidad se resuelve por `Item_Id`, nunca por SKU, `Id_Producto`, cantidad ni posición: dos líneas del mismo producto siguen siendo distintas, un cambio de cantidad conserva su identidad y snapshot, y reordenarlas no los altera. La transición a `Entregado` decide a partir de `Gestiona_Stock` del snapshot, no de la clasificación actual del producto. Así se respeta una venta pactada con su condición histórica y se evita que un cambio de catálogo reclasifique pedidos en curso.

Alternativa descartada: resolver modalidad y proveedor desde `Productos` cada vez que se entrega. Cambiaría retroactivamente el significado operativo de pedidos ya guardados.

### 2. Entregado es el único disparador y sólo una transición efectiva escribe ventas

El guardado administrativo construirá el estado candidato, identificará si cruza de un estado distinto a `Entregado` a `Entregado` y, sólo en ese caso, solicitará una venta por cada snapshot con `Gestiona_Stock = true`. `CONTRA_PEDIDO` se omite línea por línea, por lo que un mismo pedido puede mezclar modalidades. No se invocará el escritor en creación, edición ordinaria, cancelación, carrito o WhatsApp.

Alternativa descartada: descontar al guardar el pedido o según `Medio_Pago`. El primero introduce reservas no aprobadas; el segundo confunde el stock físico con Finanzas y con condiciones de pago que no forman parte de este change.

### 3. Idempotencia delegada al contrato del libro mayor

Cada venta usará exactamente `VENTA:<Id_Pedido>:<Item_Id>` y el escritor interno de C-02. El flujo tratará la devolución del movimiento existente con contenido idéntico como éxito de reintento y propagará una colisión incompatible como error. La serialización se mantendrá en el mismo límite de escritura protegido por `LockService`, evitando comprobar la clave fuera del escritor y luego insertar por separado.

Alternativa descartada: una marca mutable de "ya descontado" en el pedido. No protege contra reintentos concurrentes ni ofrece la trazabilidad e inmutabilidad que proporciona el libro mayor.

### 4. Recuperar una transición parcial sin confirmar Entregado y bloquear el pedido después

Bajo el mismo `LockService` que protege el escritor de C-02, el flujo validará el pedido candidato y aplicará una venta idempotente por cada línea gestionada. Sólo persistirá el estado `Entregado` después de que todas esas líneas hayan quedado aplicadas o reconocidas por su misma clave. Si una aplicación falla después de que otras ventas ya se registraron, no persistirá `Entregado`: el pedido seguirá recuperable y un reintento aplicará únicamente las claves faltantes, reconociendo las existentes con contenido idéntico. Nunca se borrarán ni reescribirán movimientos ya creados. Una vez persistido `Entregado`, cualquier edición directa de estado, ítems o cantidades se rechazará; una excepción física posterior se expresa como un movimiento nuevo relacionado con la venta original.

Como protección P1 de esa recuperación, si el pedido todavía pendiente ya tiene al menos una `VENTA` asentada con la clave exacta `VENTA:<Id_Pedido>:<Item_Id>`, antes de cualquier escritura se congela el conjunto completo de sus líneas persistidas. El candidato debe conservar la misma colección de `Item_Id`, producto y cantidad; sus snapshots se toman exclusivamente de las líneas persistidas. Por lo tanto no puede eliminar ni agregar líneas, sustituir una línea, ni cambiar producto o cantidad de una línea, incluso si la línea afectada ya tiene venta. La comparación usa `Item_Id`, nunca SKU ni posición. Un rechazo no modifica `Pedidos`, `Items` ni el libro mayor. Un reintento que conserva ese conjunto y sus snapshots reconoce las ventas existentes por clave, agrega sólo las faltantes y recién entonces persiste `Entregado`.

Alternativa descartada: permitir editar o revertir el pedido y regenerar ventas. Eso deja saldos ambiguos y requeriría borrar o reescribir evidencia histórica.

## Risks / Trade-offs

- [Un fallo al aplicar una línea podría dejar ventas parciales] → Mantener el pedido sin `Entregado` hasta que todas las líneas gestionadas estén aplicadas bajo el mismo `LockService`; el reintento reconoce claves existentes y crea sólo las faltantes, sin borrar ni reescribir movimientos.
- [Un reintento parcial podría quitar o reinterpretar una venta ya asentada] → Cuando exista una venta del pedido, validar bajo el mismo lock el conjunto íntegro de líneas por `Item_Id`, producto y cantidad antes de escribir; rechazar cualquier diferencia y conservar `Pedidos`, `Items` y ledger intactos.
- [Un cambio de catálogo durante el ciclo del pedido podría alterar la clasificación] → Usar únicamente el snapshot ya persistido después del primer guardado; los históricos sin snapshot se excluyen.
- [Un reintento de red podría repetir la solicitud] → Delegar la unicidad y el retorno idempotente al escritor de ventas de C-02 dentro de `LockService`.
- [Una devolución posterior podría inducir a editar la venta] → Rechazar edición del pedido entregado y requerir un movimiento adicional referenciado; el change no aporta interfaz para esa corrección.
- [El estado Entregado puede interpretarse como un comprobante financiero] → Documentar y conservar que es el hito operativo de entrega que descuenta stock; no implica ni registra cobro y Finanzas sigue siendo el registro operativo de cobros reales.

## Migration Plan

1. En el apply futuro, detectar por encabezado los campos de snapshot faltantes en `Items` y agregarlos sin reordenar ni completar filas históricas.
2. Implementar la captura de `Item_Id` y snapshot sólo para ítems nuevos, su preservación al re-guardar pedidos pendientes y la inmutabilidad para pedidos ya entregados.
3. Integrar la transición efectiva con el escritor interno de C-02 bajo el mismo `LockService`, incluyendo la recuperación idempotente tras fallo parcial, y ejecutar las pruebas focalizadas antes de cualquier despliegue.
4. Verificar manualmente una transición controlada y un reguardado sólo cuando exista autorización para operar sobre Apps Script y las fuentes reales.
5. Si se requiere rollback posterior a una venta confirmada, revertir el código de la integración sin borrar movimientos; cualquier corrección física se hace con un movimiento nuevo y referenciado.
