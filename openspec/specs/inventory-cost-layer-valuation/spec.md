# inventory-cost-layer-valuation Specification

## Purpose
Definir una valorización privada y reproducible de inventario a costo desde el ledger, con tandas internas FIFO y trazabilidad de cada salida sin crear una fuente de verdad paralela.

## Requirements

### Requirement: Tandas internas derivadas del ledger append-only
El sistema MUST derivar la valorización exclusivamente de las filas válidas de `Movimientos_Stock`, en el orden físico append-only del ledger. Cada `INGRESO` MUST originar una tanda interna identificada por su `Movimiento_Id`, con cantidad original y cantidad remanente, aun si termina con remanente cero por cubrir faltantes previos. Para un ingreso valorizable, la tanda incluye costo unitario real y modalidad de abastecimiento inmutable del momento del ingreso; la excepción histórica con modalidad vacía y costo válido se marca `LEGADO_VALORIZABLE_SIN_MODALIDAD` sin inferir modalidad actual. La tanda MUST ser una proyección de lectura: MUST NOT constituir una hoja, tabla ni fuente de verdad persistida separada. No MUST usar `Fecha` ni otro campo editable para cambiar el orden, ni representar lotes reales, vencimientos o proveedor efectivo.

#### Scenario: Dos ingresos con fechas editables fuera de orden
- **WHEN** dos ingresos válidos aparecen en filas append-only consecutivas pero sus valores de fecha-hora no siguen ese orden
- **THEN** la primera fila crea la primera tanda FIFO y la valuación no se reordena por las fechas

#### Scenario: Tanda agotada
- **WHEN** las salidas asignadas consumen toda la cantidad de una tanda
- **THEN** la tanda deja de mostrarse en la vista principal pero permanece reconstruible y visible en el historial de detalle

#### Scenario: Ingreso consumido al cubrir faltante
- **WHEN** un ingreso se aplica íntegramente a faltantes pendientes más antiguos del mismo producto
- **THEN** conserva una identidad de tanda y sus asignaciones de cobertura en el historial aunque su remanente sea cero

### Requirement: Asignación automática FIFO de salidas y correcciones
El sistema MUST asignar cada `VENTA`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION` negativa, automáticamente y sin selección manual de tanda, contra las tandas abiertas más antiguas del mismo producto hasta cubrir su cantidad. Una salida MAY tener asignaciones parciales a varias tandas y MUST conservar por cada asignación el movimiento de salida, la tanda de ingreso, cantidad y costo unitario derivados. Una `CORRECCION` positiva MUST llevar referencia obligatoria a una salida negativa anterior del mismo producto y su cantidad MUST ser como máximo la cantidad neta aún no revertida de esa salida. Debe cancelar primero el faltante pendiente de la salida y luego restaurar automáticamente cantidades y costos desde sus capas FIFO valorizadas; si el antecedente o la cantidad no permiten resolverlo de forma íntegra, el sistema MUST rechazar la corrección antes de alterar el ledger. Las correcciones MUST conservar su referencia y no MUST editar ni borrar el movimiento antecedente.

#### Scenario: Venta que cruza tandas
- **WHEN** una venta negativa excede el remanente de la tanda abierta más antigua pero existe una tanda posterior del mismo producto
- **THEN** el sistema asigna primero el remanente de la tanda antigua y luego la cantidad necesaria de la siguiente, sin intervención manual

#### Scenario: Corrección positiva trazable
- **WHEN** una corrección positiva refiere una salida previamente costeada y su cantidad puede revertirse desde sus asignaciones
- **THEN** el sistema restaura automáticamente las cantidades a sus tandas de origen con los costos históricos correspondientes y conserva ambos movimientos en el historial

#### Scenario: Reversión parcial y doble reversión
- **WHEN** dos correcciones positivas válidas refieren la misma salida negativa y sus cantidades suman exactamente su cantidad original
- **THEN** ambas se aceptan como reversiones parciales acumuladas y una corrección adicional contra esa referencia se rechaza antes de alterar el ledger

#### Scenario: Referencia de corrección inválida
- **WHEN** una corrección positiva no referencia una salida negativa previa del mismo producto, o excede su cantidad neta aún no revertida
- **THEN** se rechaza antes de escribir sin crear una tanda, asignación ni movimiento parcial

#### Scenario: Corrección de salida con faltante
- **WHEN** una corrección positiva refiere una salida que conserva cantidad pendiente de costo y además asignaciones FIFO valorizadas
- **THEN** elimina primero el faltante hasta donde alcance su cantidad y sólo después restaura las capas valorizadas de origen

### Requirement: Faltantes pendientes de costo
Cuando una salida supera las tandas disponibles, el sistema MUST conservar la parte no cubierta como faltante pendiente de costo, vinculada al movimiento de salida y ordenada por posición append-only. La salida pendiente MUST seguir afectando el saldo físico y MUST mostrarse sin costo asignado hasta que exista cobertura. El siguiente `INGRESO` del mismo producto MUST aplicar primero su cantidad, al costo de ese ingreso, a los faltantes pendientes más antiguos; sólo su excedente podrá quedar como remanente de la tanda nueva. La cobertura posterior MUST completar la trazabilidad histórica de la salida sin reordenar, editar ni reescribir el movimiento original.

#### Scenario: Salida mayor al saldo y siguiente ingreso parcial
- **WHEN** una salida deja un faltante de 5 unidades y el siguiente ingreso es de 3 unidades
- **THEN** las 3 unidades se asignan a la parte pendiente de esa salida al costo del ingreso y permanecen 2 unidades pendientes sin costo

#### Scenario: Ingreso luego de varios faltantes
- **WHEN** existen varios faltantes pendientes del mismo producto y se registra un ingreso suficiente para cubrirlos y dejar excedente
- **THEN** el ingreso cubre los faltantes en su orden append-only y su excedente queda como la tanda abierta más reciente

### Requirement: Valorización privada segregada y compatible con el historial
Para cada producto con stock gestionado, el resumen de costo MUST mostrar por separado el capital en tandas de `STOCK_PROPIO`, el valor de tandas de `CONSIGNACION` y el valor físico total a costo conocido. Un `LEGADO_VALORIZABLE_SIN_MODALIDAD` abierto MUST sumar a ese total conocido, pero MUST NOT inflar propio ni consignación y MUST marcar que la composición por modalidad es incompleta. El valor de una tanda abierta valorizable MUST ser cantidad remanente por costo unitario; los faltantes pendientes no MUST inflar los valores. Modalidad y costo históricos ambos vacíos MUST ser tramo no valorizable explícito: su saldo queda visible, pero la UI sólo puede mostrar valores conocidos y MUST indicar que no son capital total completo. Productos que hoy sean contra pedido pero tengan tandas abiertas históricas MUST permanecer visibles y valorizados por el snapshot de estas tandas; la modalidad actual es sólo informativa. La proyección MUST preservar todos los movimientos y saldos existentes, MUST NOT hacer backfill ni crear movimientos retrospectivos; el stock físico previo sin ingreso histórico sólo podrá incorporarse mediante un `INGRESO` inicial real y nuevo.

#### Scenario: Valores separados por modalidad
- **WHEN** un resumen contiene tandas abiertas de stock propio y consignación para productos gestionados
- **THEN** muestra capital propio, valor en consignación y total físico a costo como valores separados, sin publicarlos ni mezclarlos con B2C, B2B o Finanzas

#### Scenario: Legado valorizable con composición desconocida
- **WHEN** una tanda histórica abierta no tiene modalidad pero conserva un costo numérico válido
- **THEN** participa FIFO y suma a valor físico conocido, sin atribuirse a propio ni consignación, y el resumen señala la composición histórica desconocida

#### Scenario: Legados manualmente asentados como stock propio
- **WHEN** la lectura encuentra uno de los tres ingresos legado cuya modalidad fue asentada manualmente como `STOCK_PROPIO`
- **THEN** reconstruye su tanda desde esa modalidad persistida, sin backfill, cambio de costo, reescritura ni mecanismo de escritura para otros históricos

#### Scenario: Stock previo sin ingreso
- **WHEN** un producto tiene saldo físico previo que no puede trazarse a un ingreso histórico
- **THEN** el sistema no inventa una tanda ni un costo; la valorización queda sin ese origen hasta registrar un ingreso inicial real

#### Scenario: Tramo no valorizable y modalidad actual contra pedido
- **WHEN** un producto tiene un ingreso histórico no valorizable y una tanda abierta `STOCK_PROPIO` o `CONSIGNACION`, y su modalidad actual cambia a `CONTRA_PEDIDO`
- **THEN** el resumen conserva saldo, muestra el valor conocido de la tanda abierta junto con estado de total incompleto, y no reclasifica ni oculta la tanda histórica
