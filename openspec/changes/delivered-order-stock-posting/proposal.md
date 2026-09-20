## Why

El libro mayor privado ya puede registrar ventas idempotentes, pero el flujo de pedidos todavía no lo invoca cuando una entrega se concreta. Se necesita cerrar esa integración sin convertir el guardado ordinario, el carrito o WhatsApp en reservas de stock, y sin confundir un movimiento físico con un cobro en Finanzas.

## What Changes

- Incorporar al flujo administrativo de pedidos el snapshot de abastecimiento por ítem aprobado en C-01, usando el escritor de ventas ya entregado por C-02 y sin reinterpretar ni completar ítems históricos.
- Asignar `Item_Id` una única vez a cada línea nueva; al re-guardar un pedido pendiente, conservar por línea su `Item_Id`, proveedor, modalidad y `Gestiona_Stock`, sin mapear líneas por SKU o `Id_Producto`.
- Al producirse por primera vez la transición efectiva a `Entregado`, crear una `VENTA` negativa mediante el escritor interno de C-02 sólo para las líneas cuyo snapshot tiene `Gestiona_Stock = true` (`CONSIGNACION` o `STOCK_PROPIO`).
- Bajo el mismo `LockService` del libro mayor, usar exclusivamente la clave `VENTA:<Id_Pedido>:<Item_Id>` para aplicar las ventas y persistir `Entregado` sólo cuando todas las líneas gestionadas hayan quedado aplicadas; un reintento tras un fallo parcial agrega únicamente las ventas faltantes.
- Impedir que un pedido entregado pueda modificar ítems, cantidades o estado. Las excepciones posteriores se resolverán con movimientos de stock adicionales y referenciados, sin reescribir ni borrar la venta histórica.
- Mantener el historial sin snapshot legible y excluido de cualquier backfill o movimiento retrospectivo automático.

## Dependencies

- Depende directamente de C-02 (`stock-movement-ledger-api`) por su escritor interno de `VENTA`, `Clave_Idempotencia` y `LockService`.
- C-01 queda cubierto transitivamente por C-02.

## Capabilities

### New Capabilities

- `delivered-order-stock-posting`: integra la transición administrativa a `Entregado` con el snapshot inmutable de ítems y el registro de ventas idempotente del libro mayor privado.

### Modified Capabilities

- Ninguna.

## Impact

- Afectará posteriormente el Apps Script privado que guarda pedidos e ítems y consume el escritor interno de `VENTA` ya preparado por C-02.
- No modifica en esta propuesta Google Sheets, el panel admin, catálogo, B2C, B2B, despliegues ni autenticación.
- No agrega frameworks, backend, dependencias, interfaz de stock, CRUD de proveedores ni comportamiento de `Sin_Stock`.
- `Entregado` es exclusivamente el hito operativo de entrega que descuenta stock. No implica, registra ni prueba un cobro; `Medio_Pago` y Finanzas no disparan movimientos de stock.
