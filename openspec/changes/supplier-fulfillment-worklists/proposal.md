## Why

La lista operativa actual supone una única distribuidora y no puede separar con seguridad los ítems que deben comprarse contra pedido de los que se gestionan por consignación o stock propio. Con proveedores habituales y modalidades ya definidos de forma privada, la operación necesita worklists copiables que partan de los snapshots de pedidos activos sin reinterpretar su histórico ni exponer información interna.

## What Changes

- Incorporar worklists privadas de abastecimiento que agrupen ítems de pedidos activos por proveedor habitual y modalidad snapshot, conservando la separación por canal.
- Incluir exclusivamente líneas `CONTRA_PEDIDO` en las compras contra pedido; excluir `CONSIGNACION`, `STOCK_PROPIO`, pedidos cancelados y entregados, e ítems históricos sin el snapshot requerido.
- Mantener una proyección agregada compatible para Distrosec, derivada de su worklist y sin volver a mezclar proveedores, canales o modalidades.
- Permitir copiar cada worklist con productos y cantidades snapshot, sin modificar pedidos, ítems, catálogo, saldo, movimientos ni la máquina de estados existente.
- Ajustar sólo la terminología privada del panel cuando sea necesaria para que la operación no presuponga Distrosec como único proveedor.
- Definir validaciones y pruebas focalizadas para un proveedor, pedidos mixtos, dos proveedores menores, una línea marcada `Sin_Stock`, y pedidos cancelados o entregados excluidos.

## Capabilities

### New Capabilities

- `supplier-fulfillment-worklists`: generación privada de listas de abastecimiento por proveedor habitual y modalidad a partir de snapshots de ítems de pedidos activos.

### Modified Capabilities

- Ninguna.

## Impact

- Dependencias: las capacidades canónicas de contrato de abastecimiento, operaciones privadas de inventario y snapshots de ítems; C-03 (`delivered-order-stock-posting`) sigue pendiente de validación real en `main` y no queda desbloqueado por esta propuesta.
- Futura superficie afectada: lectura privada de pedidos/ítems y panel administrativo; no se implementa ni se despliega ningún cambio con esta propuesta.
- Fuera de alcance: Google Sheets, Apps Script, catálogo/JSON público, workflow remoto, B2C/B2B público, datos personales, alertas, reposición automática, reservas, listas por saldo, movimientos de stock, Finanzas y cambios de estado de pedidos.
