## 1. Snapshots e inmutabilidad del pedido

- [x] 1.1 Localizar el flujo existente de guardado administrativo de pedidos e ítems y el escritor interno de `VENTA` de C-02; confirmar sus contratos de encabezados, respuesta y `LockService` antes de editar, verificando que no se introducen cambios en B2C, B2B ni el catálogo.
- [x] 1.2 Añadir por encabezado los campos de snapshot de abastecimiento requeridos en `Items` sin reordenar columnas ni completar registros históricos; asignar `Item_Id`, proveedor, modalidad y `Gestiona_Stock` sólo al crear una línea nueva.
- [x] 1.3 Al re-guardar un pedido pendiente, identificar líneas existentes sólo por `Item_Id` y conservar su `Item_Id`, proveedor, modalidad y `Gestiona_Stock`; una línea nueva recibe ID/snapshot nuevos, sin mapear por SKU, `Id_Producto`, cantidad ni posición.
- [x] 1.4 Rechazar cambios directos de ítems, cantidades o estado de un pedido ya `Entregado`, verificando que un intento fallido conserva el pedido y el libro mayor sin cambios.

## 2. Venta automática al entregar

- [x] 2.1 Implementar la detección de transición efectiva desde un estado distinto a `Entregado` y validar el pedido candidato antes de confirmarlo, verificando que crear, editar, cancelar o guardar otro estado no invoca el escritor de ventas.
- [x] 2.2 Bajo el mismo `LockService` de C-02, aplicar una `VENTA` negativa por cada snapshot con `Gestiona_Stock = true`, usando exactamente `VENTA:<Id_Pedido>:<Item_Id>`, y persistir `Entregado` sólo si todas las líneas gestionadas quedaron aplicadas; las líneas `CONTRA_PEDIDO` de un pedido mixto no producen movimientos.
- [x] 2.3 Si una aplicación falla parcialmente, mantener el pedido sin `Entregado`; al reintentar bajo el mismo bloqueo, reconocer las ventas existentes por clave y agregar sólo las faltantes. No borrar ni reescribir movimientos existentes; rechazar una colisión incompatible y no usar `Medio_Pago` ni Finanzas como condición o registro de stock.
- [x] 2.4 Proteger la recuperación parcial antes de persistir: si existe una `VENTA:<Id_Pedido>:<Item_Id>`, conservar el conjunto completo de líneas por `Item_Id`, producto, cantidad y snapshot; rechazar sin cambios en pedido, ítems ni ledger cualquier eliminación, agregado, sustitución o alteración de producto/cantidad, y permitir sólo el reintento que agrega las ventas faltantes.

## 3. Cobertura focalizada y verificación

- [x] 3.1 Antes de cada cambio, ejecutar la cobertura focalizada existente del flujo afectado y registrar cualquier fallo preexistente; escribir primero pruebas que fallen y confirmar luego el caso en verde, sin crear dependencias, entornos temporales ni datos reales.
- [x] 3.2 Añadir únicamente pruebas focalizadas de snapshot para: re-guardar un pedido pendiente tras reclasificar catálogo, dos líneas con SKU repetido, cambio de cantidad y reordenamiento; verificar que conservan `Item_Id` y snapshot por línea, salvo las líneas nuevas.
- [x] 3.3 Añadir únicamente pruebas focalizadas de entrega para: transición a `Entregado` e idempotencia, pedido mixto con exclusión de `CONTRA_PEDIDO`, bloqueo posterior y fallo parcial multilínea. Tras un fallo parcial, verificar el rechazo sin cambios de quitar una línea vendida o alterar su cantidad/producto, y conservar el reintento idéntico que agrega sólo ventas faltantes antes de persistir `Entregado`.
- [x] 3.4 Añadir el caso de pedido histórico sin snapshot y verificar que sigue legible, no recibe backfill y no crea movimientos retrospectivos; verificar además que cualquier corrección posterior se expresa como un movimiento nuevo referenciado, sin reescribir una `VENTA`.
- [ ] 3.5 Realizar la verificación manual mínima del flujo administrativo con datos no personales sólo cuando esté autorizada la implementación; documentar qué se verificó y confirmar que no se hicieron escrituras sintéticas productivas ni cambios en Finanzas, B2C, B2B o catálogo.
