# Spec Delta

## ADDED Requirements

### Requirement: Inventario valorizado y detalle trazable por producto
La vista privada principal de Inventario MUST mostrar, por producto gestionado, saldo físico derivado, modalidad actual sólo informativa, capital en stock propio, valor en consignación, valor físico total a costo conocido y la cantidad o estado de faltante pendiente de costo cuando exista. Si tiene un tramo no valorizable, MUST mostrar ese estado y MUST NOT presentar el valor conocido como capital total completo. Si tiene un `LEGADO_VALORIZABLE_SIN_MODALIDAD`, MUST incluirlo sólo en valor físico conocido, MUST NOT atribuirlo a propio ni consignación y MUST mostrar una advertencia visible de composición por modalidad histórica incompleta. Un producto con tandas abiertas MUST continuar visible y valorizado aunque su modalidad actual sea `CONTRA_PEDIDO`. Las tandas agotadas MUST quedar fuera de esa vista principal. Al abrir un producto, el panel MUST mostrar el detalle sólo de lectura de tandas abiertas y agotadas —incluidas las que terminaron en cero por cubrir faltantes—, sus movimientos de ingreso de origen, consumo remanente, asignaciones de salida, correcciones relacionadas y faltantes pendientes o cubiertos. El panel MUST NOT permitir elegir, reordenar, editar, eliminar, fusionar ni crear manualmente una tanda; toda asignación se explica como resultado automático FIFO.

#### Scenario: Tabla principal con faltante pendiente
- **WHEN** un producto gestionado tiene saldo físico y una parte de salidas pendiente de costo
- **THEN** la tabla presenta sus tres valores de costo separados y señala el faltante sin atribuirle capital propio ni valor de consignación

#### Scenario: Apertura de detalle de producto
- **WHEN** una persona operadora abre el producto en Inventario
- **THEN** ve la trazabilidad de tandas, salidas y correcciones incluyendo las tandas agotadas, sin controles para seleccionar manualmente una tanda ni información de clientes o cobros

#### Scenario: Valor conocido incompleto
- **WHEN** un producto tiene una tanda abierta no valorizable y otra valorizable
- **THEN** la tabla muestra el valor conocido separado y el estado de capital total incompleto, y el modal identifica la tanda sin origen de costo histórico

#### Scenario: Advertencia de modalidad histórica desconocida
- **WHEN** un producto tiene una tanda abierta valorizable con costo histórico pero sin modalidad
- **THEN** la tabla suma su costo sólo al valor físico conocido, muestra la advertencia de composición incompleta y el modal identifica la tanda como legado valorizable sin modalidad histórica
