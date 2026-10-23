# Design

## Context

Ver `proposal.md`. `Items` congela el costo de referencia y la ganancia estimada; `Movimientos_Stock` registra las ventas entregadas y los costos reales de ingresos. El proyector FIFO existente conoce asignaciones y coberturas posteriores, pero no las relaciona aún con la vista de ganancias del admin. El pedido entregado es inmutable y las correcciones de stock son movimientos físicos adicionales.

## Goals / Non-Goals

**Goals:** derivar en una sola lectura privada el costo de cada venta y mostrar por pedido un indicador diferenciado de ganancia con costo FIFO, sólo si es completo y trazable. Conservar la carga rápida y el cálculo existente del panel si la nueva lectura falla.

**Non-Goals:** cambiar la cotización al cliente, sobrescribir `Costo`/`Ganancia` de `Pedidos` o `Items`, modificar la ganancia estimada/KPIs existentes, calcular costo de logística, cobrar, liquidar consignación, valorar contra pedido desde un ingreso o crear una fuente persistente de costo de ventas.

## Decisions

1. **Proyectar una única vez en Apps Script.** La consulta lee el ledger existente, lo valida y reutiliza `proyectarValorizacionLedger`. Para cada `VENTA` suma las asignaciones FIFO y coberturas posteriores de su movimiento original. Devuelve sólo `Id_Pedido`, `Item_Id`, cantidad, cantidad valorizada, cantidad pendiente y costo conocido. No hace joins con clientes, precios ni pedidos; el panel ya tiene sus snapshots. Alternativa descartada: duplicar FIFO en JavaScript del admin o crear hoja de costo de ventas.
2. **Completo significa identidad y costo íntegros.** El admin sólo calcula `Total` congelado menos costos FIFO gestionados menos costos de referencia congelados contra pedido si todas las líneas gestionadas tienen su `VENTA` correspondiente, cantidades coincidentes y costo para cada unidad. Una tanda histórica no valorizable o un faltante abierto produce estado pendiente y muestra costo conocido, no un margen numérico definitivo. Un histórico sin snapshot no se reconstruye desde catálogo actual.
3. **Indicador comercial separado.** En la lista de pedidos, la ganancia estimada sigue intacta y el pedido entregado elegible muestra debajo su ganancia FIFO o estado pendiente. Un KPI adicional suma sólo ganancias FIFO completas de pedidos entregados del canal actual, indica cobertura y no reemplaza los KPIs/estadísticas previos. Pedidos al costo se excluyen de KPI comercial como hoy. B2B se calcula sólo con pedidos B2B cuando el canal esté activo.
4. **Correcciones físicas independientes.** Una `CORRECCION` positiva puede reabrir stock, pero sin ajuste financiero al pedido no puede cambiar por sí sola el ingreso congelado. La nueva lectura informa el costo de la `VENTA` original usando cantidades originales de sus asignaciones/coberturas, no saldos netos revertidos. Se presenta como margen operativo antes de logística, no utilidad contable definitiva.
5. **Lectura aislada del flujo crítico.** El admin solicita el nuevo GET en paralelo a la carga de pedidos; si falla, mantiene visibles los pedidos y la estimación y muestra el margen FIFO como no disponible. Tras guardar una entrega, refresca esa lectura sin hacer otra escritura. No se agrega trabajo FIFO a `guardarPedido` ni a la transición crítica `Entregado`.

## Risks / Trade-offs

- [El margen puede cambiar tras reponer un faltante] → etiquetar pendiente hasta cobertura completa; el ingreso posterior aporta su costo sin reescribir la venta.
- [Corrección física sin reembolso o nota financiera] → mantener el costo de venta original en este indicador; no atribuirle utilidad contable.
- [Más tiempo de lectura de ledger] → una consulta global por carga/refresco, sin llamadas por pedido ni lectura de todas las hojas operativas.
- [Ledger inválido] → fallo cerrado de la lectura FIFO, sin afectar la lista de pedidos o su ganancia estimada.

## Migration Plan

No hay migración ni backfill. Publicar manualmente una nueva versión del Apps Script en el deployment existente y luego el admin actualizado. Revisión no destructiva de pedidos entregados con costo completo, mixto y pendiente; desktop y mobile. Rollback al deployment anterior y código anterior: ningún dato requiere reversión.
