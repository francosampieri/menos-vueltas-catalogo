# Proposal

## Why

La ganancia de un pedido usa el costo de referencia congelado al cargar la línea, aunque la unidad entregada haya salido de una tanda con otro costo. El ledger ya permite reconstruir el costo FIFO efectivo; falta mostrar esa información sin confundirla con el margen estimado ni alterar importes históricos.

## What Changes

- Incorporar una lectura privada y pura del costo FIFO de cada `VENTA` identificada por `Id_Pedido` e `Item_Id`.
- Mostrar en la lista y en un nuevo KPI del admin la ganancia con costo FIFO de pedidos entregados con líneas de stock, separada de la ganancia estimada y de las estadísticas actuales. Las líneas contra pedido mantienen su costo de referencia congelado.
- Señalar un margen parcial/pendiente cuando una venta tenga unidades sin costo asignado, incluso tras ingresos posteriores; no tratarlas como costo cero definitivo.
- Mantener precios al cliente, pedidos, ítems, movimientos y estadísticas históricas existentes sin reescritura. Las correcciones de stock son ajustes físicos independientes y no alteran el ingreso congelado del pedido ni el costo original de su venta.

## Capabilities

### New Capabilities

- `fifo-sale-margin`: cálculo y presentación privada del margen FIFO de ventas entregadas, con estado de completitud explícito.

### Modified Capabilities

Ninguna.

## Impact

- `apps-script/Code.gs`: endpoint de lectura basado en la proyección FIFO existente.
- `admin/admin.js` y `admin/index.html`: consulta y presentación de margen separado sin cambiar el cálculo de precios ni las estadísticas actuales.
- Pruebas focalizadas de Apps Script y admin. Sin hojas, columnas, dependencias, publicaciones públicas ni escrituras nuevas.
