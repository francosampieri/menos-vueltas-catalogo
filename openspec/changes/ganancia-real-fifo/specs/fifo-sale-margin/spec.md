# Spec Delta

## Purpose

Permitir que el responsable compare la ganancia estimada del pedido con un margen de ventas entregadas basado en el costo de las tandas FIFO realmente asignadas, sin alterar el historial comercial.

## ADDED Requirements

### Requirement: Costo FIFO de cada venta entregada
El sistema MUST reconstruir en lectura, desde `Movimientos_Stock` validado y en orden append-only, el costo de cada `VENTA` identificada por `Id_Pedido` e `Item_Id`. MUST sumar todas las asignaciones a tandas valorizables, aunque una venta cruce tandas o un ingreso posterior cubra un faltante. MUST informar por separado cantidad con costo conocido y cantidad pendiente/no valorizable; esta última MUST NOT considerarse de costo cero definitivo. El resultado MUST ser privado, puro e idempotente, sin crear hojas ni reescribir movimientos.

#### Scenario: Venta cruza dos tandas
- **WHEN** una venta de tres unidades consume dos de una tanda a $10 y una de otra a $20
- **THEN** informa costo FIFO conocido de $40, tres unidades valorizadas y ninguna pendiente

#### Scenario: Faltante cubierto después
- **WHEN** una venta sin saldo deja dos unidades pendientes y un ingreso posterior de una unidad a $15 cubre una
- **THEN** informa $15 de costo conocido, una unidad valorizada y una unidad aún pendiente

#### Scenario: Ingreso histórico sin costo
- **WHEN** una venta consume una tanda histórica no valorizable
- **THEN** informa esa unidad como no valorizable y no la suma como costo cero definitivo

#### Scenario: Corrección física de venta
- **WHEN** una corrección positiva revierte físicamente una parte de una venta
- **THEN** la lectura conserva el costo FIFO original de esa venta para su indicador comercial y no altera su ingreso ni su precio congelados

### Requirement: Margen FIFO separado en el admin
El admin MUST mostrar una ganancia FIFO separada de la ganancia estimada existente sólo para pedidos `Entregado` con líneas gestionadas y `Item_Id` estable. MUST mostrar también un KPI separado que sume sólo pedidos entregados con cálculo FIFO completo del canal activo y comunique cuántos siguen pendientes, sin reemplazar el KPI ni las estadísticas estimadas existentes. MUST usar el total comercial congelado del pedido, el costo FIFO de sus líneas gestionadas y el costo de referencia congelado de las líneas `CONTRA_PEDIDO`; MUST NOT usar el costo de catálogo vigente ni cambiar precios, totales o columnas guardadas. Si faltan ventas vinculadas, capas con costo o unidades aún pendientes, MUST mostrar el margen como parcial/pendiente en vez de una ganancia definitiva. Pedidos históricos sin snapshots y pedidos no entregados MUST conservar la presentación estimada existente sin inferir movimientos retrospectivos. El indicador MUST NOT representar cobros reales ni utilidad contable definitiva y MUST mantenerse separado por canal.

#### Scenario: Pedido mixto entregado y completo
- **WHEN** un pedido entregado tiene una línea gestionada con costo FIFO conocido y una línea contra pedido con costo congelado
- **THEN** muestra su ganancia FIFO separada de la estimada usando ambos costos y el total congelado

#### Scenario: Pedido entregado con costo parcial
- **WHEN** una venta gestionada aún tiene una unidad sin costo asignado
- **THEN** el admin muestra un cálculo parcial y una advertencia de costo pendiente, sin presentarlo como ganancia definitiva ni sumarlo a un KPI definitivo

#### Scenario: Pedido histórico sin snapshot
- **WHEN** un pedido entregado no tiene `Item_Id` o snapshot de gestión de stock completo
- **THEN** el admin conserva la ganancia estimada y no atribuye un costo FIFO inferido

#### Scenario: Pedido no entregado o al costo
- **WHEN** un pedido está pendiente o es un pedido B2C al costo de uso interno
- **THEN** el indicador FIFO no se suma a las métricas comerciales de ventas entregadas; el pedido conserva su operatividad y cotización existentes

### Requirement: Compatibilidad y privacidad
La lectura y el panel MUST mantener el costo FIFO, las identidades de venta y el margen exclusivamente en la superficie administrativa. MUST NOT modificar `Pedidos`, `Items`, `Movimientos_Stock`, Finanzas, las estadísticas estimadas actuales, la publicación de catálogo, los precios B2C/B2B ni las reglas de disponibilidad. Ante un ledger malformado, la lectura MUST fallar cerradamente y el admin MUST mantener visibles los pedidos y su estimación sin mostrar margen FIFO parcial engañoso.

#### Scenario: Ledger malformado
- **WHEN** una fila de movimientos incumple el contrato de valorización
- **THEN** la consulta falla sin entregar márgenes parciales ni escribir datos

#### Scenario: Sin cambio público ni financiero
- **WHEN** se consulta el margen FIFO
- **THEN** no se publica costo en B2C/B2B ni se registra un cobro o asiento en Finanzas
