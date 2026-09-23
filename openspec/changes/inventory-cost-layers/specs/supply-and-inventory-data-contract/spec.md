# Spec Delta

## ADDED Requirements

### Requirement: Tandas de costo no son lotes ni una fuente de inventario independiente
El contrato de abastecimiento MUST tratar las tandas internas como una proyección privada de costo de `Movimientos_Stock`: cada una deriva de un `INGRESO`, incluso si todo su ingreso cubre faltantes y deja remanente cero, y de su clasificación inmutable de ingreso, sin introducir lotes físicos, vencimientos, proveedor efectivo ni una entidad editable paralela. El orden canónico para FIFO MUST ser el de inserción append-only del ledger. Las filas y saldos históricos MUST conservarse sin backfill, reescritura ni movimientos retrospectivos; un saldo físico previo sin ingreso histórico requiere un ingreso inicial nuevo, explícito y real antes de poder valorarse. Esta capacidad MUST permanecer fuera del catálogo, la disponibilidad pública, precios, B2C, B2B y Finanzas.

#### Scenario: Cambio posterior de modalidad del producto
- **WHEN** cambia la modalidad actual de un producto después de un ingreso ya registrado
- **THEN** la tanda derivada conserva la modalidad inmutable que tuvo el ingreso, sigue visible y valorizada si está abierta aun cuando el producto pase a `CONTRA_PEDIDO`, y la re-clasificación no revaloriza ni reescribe su historia

#### Scenario: Ausencia de origen histórico de costo
- **WHEN** se consulta un saldo existente sin ingreso histórico que lo origine
- **THEN** el contrato no lo trata como tanda ni inventa un costo, lote o proveedor efectivo

### Requirement: Modalidad privada obligatoria en ingresos nuevos y compatibilidad histórica explícita
`Movimientos_Stock` MUST incorporar la columna privada `Modalidad_Abastecimiento`, identificada por encabezado. Todo `INGRESO` nuevo MUST incluir exactamente `STOCK_PROPIO` o `CONSIGNACION` y un costo unitario válido; la escritura MUST rechazar antes del append cualquier otro valor, vacío o costo insuficiente. Un `INGRESO` histórico con modalidad vacía o costo insuficiente MUST conservarse sin backfill como tramo no valorizable explícito. Cualquier dato malformado que no corresponda a esa compatibilidad histórica MUST fallar cerradamente para la valorización, sin inventar modalidad, costo o total completo.

#### Scenario: Ingreso histórico no valorizable
- **WHEN** un ingreso histórico tiene `Modalidad_Abastecimiento` vacía o no tiene costo suficiente para valorarlo
- **THEN** mantiene su identidad y saldo físico como tramo no valorizable, y no entra en los valores de capital conocidos ni se completa su fila

#### Scenario: Ingreso nuevo inválido
- **WHEN** se intenta registrar un ingreso nuevo con modalidad vacía, `CONTRA_PEDIDO`, otro valor distinto de los dos admitidos o costo inválido
- **THEN** el contrato rechaza la operación antes de agregar un movimiento al ledger
