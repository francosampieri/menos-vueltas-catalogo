# Tasks

## 1. Lectura FIFO de ventas

- [x] 1.1 Agregar primero pruebas RED para costo de venta cruzando tandas, faltante cubierto después, histórico sin costo, corrección física y fallo cerrado; verificar que fallan por falta de la nueva lectura.
- [x] 1.2 Implementar un único GET privado y puro de costos de `VENTA` reutilizando la proyección FIFO; verificar pruebas focalizadas GREEN y que no hay escrituras ni datos de clientes.

## 2. Indicador separado en admin

- [x] 2.1 Agregar primero pruebas RED de pedido mixto completo, costo parcial, venta ausente, histórico sin snapshot, canal y pedido al costo; verificar que fallan por falta del cálculo.
- [x] 2.2 Mostrar ganancia FIFO por pedido y un KPI de entregados completos, sin reemplazar ganancia estimada ni estadísticas actuales; verificar pruebas focalizadas GREEN y separación de canales.
- [x] 2.3 Consultar la lectura FIFO sin bloquear la lista y refrescarla tras entregar; verificar fallback ante fallo de red y persistencia del indicador estimado.

## 3. Integración y revisión

- [x] 3.1 Ejecutar suite completa, sintaxis, `git diff --check` y validación estricta de OpenSpec; registrar resultados (105/105 pruebas verdes).
- [ ] 3.2 Tras despliegue manual, revisar en admin desktop/mobile un entregado con costo completo, otro pendiente si existe y KPI separado, sin datos sintéticos ni escrituras; registrar lo verificado antes de archivar.
