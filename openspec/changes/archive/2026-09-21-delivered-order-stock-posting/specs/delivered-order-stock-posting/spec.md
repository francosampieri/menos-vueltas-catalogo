## Purpose

Conecta la entrega efectiva de un pedido con ventas de stock inmutables e idempotentes, preservando los snapshots de abastecimiento y el historial operativo existente.

## ADDED Requirements

### Requirement: Identidad y snapshot de abastecimiento de cada línea
El sistema MUST asignar a cada línea nueva de un pedido un `Item_Id` estable y único dentro del pedido una sola vez y, en ese momento, congelar `Id_Proveedor`, `Modalidad_Abastecimiento` y `Gestiona_Stock` desde la clasificación vigente del producto. Al re-guardar un pedido pendiente, el sistema MUST conservar por cada línea existente su `Item_Id`, `Id_Proveedor`, `Modalidad_Abastecimiento` y `Gestiona_Stock`; las líneas nuevas MUST recibir un `Item_Id` y snapshot nuevos. El sistema MUST identificar líneas existentes por `Item_Id`, MUST NOT mapearlas por SKU, `Id_Producto`, cantidad ni posición, y MUST preservar su identidad y snapshot ante cambios de cantidad o reordenamiento. `Gestiona_Stock` MUST ser `true` únicamente para `CONSIGNACION` y `STOCK_PROPIO`, y MUST ser `false` para `CONTRA_PEDIDO`. Cambios posteriores en el catálogo MUST NOT reinterpretar el snapshot. Los ítems históricos que no tengan esos campos MUST seguir siendo legibles, MUST NOT recibir backfill y MUST NOT generar ventas automáticas.

#### Scenario: Pedido nuevo con modalidades mixtas
- **WHEN** se guarda un pedido con líneas `CONTRA_PEDIDO`, `CONSIGNACION` y `STOCK_PROPIO`
- **THEN** cada línea conserva su propio snapshot y sólo las líneas de consignación o stock propio quedan con `Gestiona_Stock = true`

#### Scenario: Re-guardado pendiente tras reclasificar catálogo
- **WHEN** se re-guarda un pedido pendiente después de que el catálogo reclasifica un producto de una de sus líneas existentes
- **THEN** esa línea conserva su `Item_Id`, `Id_Proveedor`, `Modalidad_Abastecimiento` y `Gestiona_Stock`, mientras una línea nueva recibe un ID y snapshot nuevos

#### Scenario: Dos líneas con SKU repetido
- **WHEN** un pedido pendiente contiene dos líneas del mismo SKU o `Id_Producto`
- **THEN** cada línea conserva un `Item_Id` y snapshot distintos y el sistema no las fusiona ni las identifica por SKU

#### Scenario: Cambio de cantidad y reordenamiento
- **WHEN** se cambia la cantidad de una línea existente o se reordenan las líneas de un pedido pendiente
- **THEN** cada línea conserva su `Item_Id` y snapshot originales

#### Scenario: Ítem histórico sin snapshot
- **WHEN** se procesa un pedido histórico cuyos ítems no tienen snapshot de abastecimiento
- **THEN** el pedido permanece legible y no se completan campos ni se generan movimientos retrospectivos

### Requirement: Venta automática sólo en la transición efectiva a Entregado
El sistema MUST crear movimientos internos `VENTA` exclusivamente al realizar la transición efectiva de un pedido a `Entregado`. Por cada ítem cuyo snapshot tenga `Gestiona_Stock = true`, MUST crear una venta con cantidad negativa, `Id_Pedido`, `Item_Id` y la clave exacta `VENTA:<Id_Pedido>:<Item_Id>`. No MUST crear ventas para ítems `CONTRA_PEDIDO`, ni al crear, editar, guardar en otro estado, cancelar, armar un carrito o iniciar un pedido por WhatsApp. `Entregado` es el hito operativo de entrega que descuenta stock; MUST NOT implicar, registrar ni probar un cobro. `Medio_Pago` y Finanzas MUST NOT alterar ni disparar este comportamiento.

#### Scenario: Transición de pedido mixto a Entregado
- **WHEN** un pedido con una línea de stock propio, una de consignación y una contra pedido pasa por primera vez a `Entregado`
- **THEN** se registra una sola venta negativa por cada línea gestionada y ninguna venta por la línea contra pedido

#### Scenario: Estado distinto de Entregado
- **WHEN** se crea, edita o guarda un pedido con cualquier estado distinto de `Entregado`, incluido `Cancelado`
- **THEN** no se registra ningún movimiento automático de venta

#### Scenario: Medio de pago sin efecto de inventario
- **WHEN** se agrega o modifica `Medio_Pago` sin realizar una transición efectiva a `Entregado`
- **THEN** el libro mayor no cambia y Finanzas sigue siendo el registro operativo de cobros reales

### Requirement: Idempotencia, recuperación y persistencia atómica de Entregado
La creación automática de ventas MUST usar el escritor interno serializado del libro mayor, su `LockService` y la unicidad de `Clave_Idempotencia`. Bajo ese mismo bloqueo, el sistema MUST aplicar una venta por cada línea gestionada y MUST persistir `Entregado` sólo después de que todas las líneas gestionadas hayan sido aplicadas o reconocidas por una clave existente con contenido idéntico. Si una venta con la clave exacta ya existe y tiene el mismo contenido, el sistema MUST tratarla como reintento y MUST NOT crear otra fila. Si una aplicación falla parcialmente, el sistema MUST dejar el pedido recuperable sin persistir `Entregado`; un reintento MUST agregar únicamente las ventas faltantes por clave. Si la clave existe con contenido incompatible, el sistema MUST rechazar la operación sin agregar una venta. El sistema MUST NOT borrar ni reescribir movimientos existentes. Dos intentos concurrentes con la misma clave MUST dejar como máximo una venta en el libro mayor.

Mientras un pedido pendiente tenga al menos una `VENTA` existente con la clave exacta `VENTA:<Id_Pedido>:<Item_Id>`, el sistema MUST proteger la recuperación bajo ese mismo bloqueo antes de modificar la persistencia. El candidato MUST conservar el conjunto completo de líneas persistidas identificado por `Item_Id`, junto con su producto, cantidad y snapshots persistidos; el sistema MUST NOT identificar ni comparar líneas por SKU o posición. El sistema MUST rechazar, sin cambios en `Pedidos`, `Items` ni ledger, cualquier eliminación, agregado, sustitución o cambio de producto o cantidad de una línea durante esa recuperación. Un reintento que conserva el conjunto y snapshots MUST reconocer las ventas existentes por clave, MUST agregar únicamente las faltantes y MUST persistir `Entregado` sólo después de completar todas las líneas gestionadas.

#### Scenario: Fallo parcial en pedido mixto multilínea y reintento idéntico
- **WHEN** al transicionar a `Entregado` un pedido mixto con varias líneas gestionadas registra algunas ventas y falla antes de aplicar todas
- **THEN** el pedido no persiste `Entregado`, las ventas existentes no se borran ni reescriben y un reintento registra únicamente las claves faltantes antes de persistir `Entregado`

#### Scenario: Recuperación parcial intenta quitar una línea ya vendida
- **WHEN** un pedido pendiente tiene una venta parcial y un reintento elimina una de sus líneas ya vendidas
- **THEN** el sistema rechaza el reintento antes de escribir y no cambia `Pedidos`, `Items` ni el ledger

#### Scenario: Recuperación parcial altera una línea ya vendida
- **WHEN** un pedido pendiente tiene una venta parcial y un reintento cambia el producto o cantidad de una línea ya vendida
- **THEN** el sistema rechaza el reintento antes de escribir y no cambia `Pedidos`, `Items` ni el ledger

#### Scenario: Reintento concurrente de una línea gestionada
- **WHEN** dos solicitudes intentan registrar la venta de la misma línea entregada con la misma clave
- **THEN** el libro mayor conserva como máximo una venta para esa clave y ningún intento agrega una salida duplicada

#### Scenario: Colisión con contenido incompatible
- **WHEN** una clave `VENTA:<Id_Pedido>:<Item_Id>` existente se encuentra asociada a un producto, cantidad o identidad de línea distintos
- **THEN** la transición se rechaza sin registrar una venta adicional

### Requirement: Pedido entregado inmutable y correcciones trazables
Después de que un pedido quede `Entregado`, el sistema MUST rechazar cambios directos de ítems, productos, cantidades o estado. Una devolución, sustitución, corrección de cantidad u otra excepción posterior MUST registrarse mediante un movimiento de stock nuevo, explícito y referenciado al pedido, ítem y venta original; el sistema MUST NOT borrar ni reescribir la venta histórica.

#### Scenario: Intento de editar un pedido entregado
- **WHEN** se intenta cambiar un ítem, una cantidad o el estado de un pedido que ya está `Entregado`
- **THEN** la operación se rechaza y no modifica ni el pedido ni la venta histórica

#### Scenario: Corrección física posterior
- **WHEN** una línea entregada debe devolver o ajustar físicamente stock
- **THEN** se registra un movimiento adicional y referenciado sin alterar la venta automática original
