# Spec Delta

## ADDED Requirements

### Requirement: Consulta privada y pura de valorización por tandas
La API administrativa MUST ofrecer una consulta privada y de sólo lectura que derive tandas, asignaciones FIFO, faltantes pendientes y valores a costo exclusivamente desde el ledger validado y la clasificación inmutable de cada ingreso. Para la compatibilidad histórica explícita, modalidad vacía con costo numérico válido MUST responder como `LEGADO_VALORIZABLE_SIN_MODALIDAD`: conserva el costo, suma a valor físico conocido, no se atribuye a propio ni consignación y expone composición por modalidad incompleta. Modalidad y costo ambos vacíos MAY exponerse como tramo no valorizable, sin presentarse como capital total completo. La consulta MUST fallar de forma cerrada ante costo no numérico, modalidad fuera del enum u otra información malformada; MUST NOT crear hojas, encabezados, filas de asignación, backfills ni movimientos. La respuesta MUST conservar la semántica actual del saldo algebraico y MUST NOT modificar acciones existentes, precios de venta, `Sin_Stock`, Finanzas, proveedor efectivo, B2C, B2B ni representaciones públicas.

#### Scenario: Lectura de valuación válida
- **WHEN** el admin consulta la valuación de un ledger completo y válido
- **THEN** recibe la proyección de costo y el saldo físico derivado sin que la consulta escriba datos operativos ni publique información privada

#### Scenario: Ledger inválido durante la valuación
- **WHEN** una fila necesaria para reconstruir una tanda, asignación o corrección incumple el contrato
- **THEN** la consulta devuelve un error explícito y no entrega una valuación parcial ni altera el libro mayor

#### Scenario: Tramo histórico no valorizable durante la lectura
- **WHEN** un ingreso histórico compatible tiene modalidad y costo ambos vacíos
- **THEN** la consulta expone el tramo no valorizable y, si hay valores conocidos, los identifica como incompletos sin escribir ni completar el ledger

#### Scenario: Legado valorizable sin modalidad durante la lectura
- **WHEN** un ingreso histórico tiene modalidad vacía y costo numérico válido
- **THEN** la consulta conserva su costo y FIFO, suma al total físico conocido sin asignarlo a propio o consignación, y expone la advertencia de composición por modalidad incompleta
