# Spec Delta

## ADDED Requirements

### Requirement: Inventario valorizado y detalle trazable por producto
La vista privada principal de Inventario MUST mostrar exactamente cinco columnas: Producto, Proveedor, Modalidad, Saldo y Valor total (suma de tandas abiertas por remanente × costo). No MUST tener botón o columna de detalle. Cada fila MUST ser clickeable, tener hover y foco visible, y abrir el mismo detalle con click, Enter o Espacio. El wrapper puede desplazarse horizontalmente en móvil sin ampliar el body. Un producto con tandas abiertas MUST continuar visible y valorizado aunque su modalidad actual sea `CONTRA_PEDIDO`. Las tandas agotadas, capital propio/consignación, faltantes, composición y trazabilidad MUST vivir en el detalle de sólo lectura. El detalle MUST usar etiquetas humanas en español —Ingreso, Venta automática por pedido, Consumo propio, Merma, Corrección y asignación FIFO— y MUST NOT mostrar UUID, códigos técnicos, clientes, PII ni cobros. El historial general MUST ocultar `Movimiento_Id`, `Item_Id` y referencias internas: una venta muestra `Pedido #<Id_Pedido>`; ingreso, consumo propio y merma sin antecedente muestran `—`; una corrección resuelve el UUID interno en la colección completa como `Tipo humano · fecha corta · cantidad u.`. El selector de antecedente MUST mostrar esa misma descripción y conservar el UUID sólo como valor interno. El panel MUST NOT permitir elegir, reordenar, editar, eliminar, fusionar ni crear manualmente una tanda.

#### Scenario: Tabla principal compacta y accesible
- **WHEN** una persona operadora ve Inventario en desktop o mobile
- **THEN** encuentra sólo las cinco columnas definidas y abre el detalle de la fila por click, Enter o Espacio, sin que la tabla amplíe el body en móvil

#### Scenario: Apertura de detalle de producto
- **WHEN** una persona operadora abre el producto en Inventario
- **THEN** ve la trazabilidad de tandas, salidas y correcciones incluyendo las tandas agotadas, sin controles para seleccionar manualmente una tanda ni información de clientes o cobros

#### Scenario: Historial y antecedente de corrección sin UUID visible
- **WHEN** una persona operadora consulta una venta o una corrección en el historial, o abre el selector de antecedente
- **THEN** la venta muestra `Pedido #<Id_Pedido>` y la corrección muestra la descripción humana del antecedente; el selector conserva el UUID sólo como valor interno y no muestra `Movimiento_Id`, `Item_Id`, referencia interna, clientes ni PII

#### Scenario: Valor conocido incompleto
- **WHEN** un producto tiene una tanda abierta no valorizable y otra valorizable
- **THEN** la tabla muestra el valor conocido separado y el estado de capital total incompleto, y el modal identifica la tanda sin origen de costo histórico

#### Scenario: Composición y modalidad histórica en detalle
- **WHEN** un producto tiene una tanda abierta valorizable con costo histórico pero sin modalidad
- **THEN** el detalle identifica la tanda como legado valorizable sin modalidad histórica y muestra la composición incompleta sin atribuirla a propio o consignación
