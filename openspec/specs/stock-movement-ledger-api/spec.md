# stock-movement-ledger-api Specification

## Purpose
Proveer un libro mayor privado, inmutable y auditable de stock, junto con acciones administrativas mínimas para operar proveedores, registrar movimientos y consultar saldos sin convertir el catálogo público en una fuente de inventario.

## Requirements

### Requirement: Materialización compatible de datos privados de abastecimiento
El sistema MUST mantener `Proveedores` exclusivamente en la planilla operativa y `Productos` en la planilla de catálogo. Antes de crear los nuevos encabezados `Productos.Id_Proveedor`, `Productos.Modalidad_Abastecimiento` y `Productos.Sin_Stock`, el sistema MUST comprobar que la preservación de códigos legacy exigida por C-01 ya se completó; si la comprobación falla, MUST abortar sin crear ni escribir los nuevos campos. Los encabezados nuevos MUST resolverse por nombre, MUST añadirse sin reordenar columnas existentes y MUST dejar vacías las filas históricas. Una fila histórica vacía MUST interpretarse como `CONTRA_PEDIDO`, `Gestiona_Stock = false` y `Sin_Stock = false`, sin escribir esos valores como backfill.

#### Scenario: Precondición de migración satisfecha
- **WHEN** los códigos legacy están preservados y se inicializa C-02
- **THEN** se añaden únicamente los encabezados faltantes de abastecimiento y no se modifica ninguna celda histórica

#### Scenario: Preservación legacy no comprobable
- **WHEN** la inicialización no puede demostrar que los códigos legacy fueron preservados conforme a C-01
- **THEN** se aborta antes de crear la nueva FK `Productos.Id_Proveedor` o escribir datos de abastecimiento

#### Scenario: Producto histórico no clasificado
- **WHEN** se consulta un producto cuyas nuevas celdas de abastecimiento están vacías
- **THEN** la respuesta lo interpreta como contra pedido, sin stock gestionado y disponible, sin completar la fila

#### Scenario: Producto nuevo o reclasificado válido
- **WHEN** se guarda la clasificación de un producto con proveedor existente y activo, modalidad `CONTRA_PEDIDO`, `CONSIGNACION` o `STOCK_PROPIO`, y `Sin_Stock` booleano
- **THEN** se acepta la configuración y `Gestiona_Stock` se deriva como verdadero sólo para consignación o stock propio

#### Scenario: Producto con proveedor o modalidad inválidos
- **WHEN** una clasificación nueva referencia un proveedor inexistente o inactivo, una modalidad no admitida o un `Sin_Stock` no booleano
- **THEN** se rechaza la operación completa sin alterar la fila de producto

### Requirement: Lectura y escritura administrativa de proveedores
La API de Apps Script MUST ofrecer acciones orientadas al admin separadas para listar, crear y actualizar proveedores usando el contrato `Id_Proveedor`, `Nombre`, `Telefono`, `Direccion`, `Activo` y `Notas`. `crearProveedor` MUST recibir `Id_Proveedor` y rechazar una PK ya existente. `actualizarProveedor` MUST recibir `Id_Proveedor_Original` para identificar el registro objetivo y sólo MUST permitir cambiar `Nombre`, `Telefono`, `Direccion`, `Activo` y `Notas`; si el payload incluye también `Id_Proveedor`, MUST coincidir exactamente con `Id_Proveedor_Original`. `Id_Proveedor` MUST ser texto no vacío, estable y único; `Nombre` MUST ser no vacío y `Activo` MUST ser booleano. Los campos opcionales MAY estar vacíos. Una operación inválida MUST fallar sin modificar otras filas. C-02 MUST NOT exponer una acción de borrado físico; la continuidad operativa se representa con `Activo`.

#### Scenario: Listado administrativo
- **WHEN** el admin solicita la acción de listado de proveedores
- **THEN** la API devuelve los proveedores de la planilla operativa con sus campos privados y no los copia a la planilla de catálogo

#### Scenario: Alta válida
- **WHEN** se guarda un proveedor sintético con PK nueva, nombre y estado booleano
- **THEN** se crea una única fila y la respuesta confirma el registro guardado

#### Scenario: Actualización válida
- **WHEN** se actualiza un proveedor indicando su `Id_Proveedor_Original` y campos mutables válidos
- **THEN** se actualizan sólo sus campos por nombre de encabezado sin crear una fila duplicada

#### Scenario: Intento de mutar la PK
- **WHEN** una actualización incluye un `Id_Proveedor` distinto de `Id_Proveedor_Original`
- **THEN** la API rechaza la solicitud sin modificar el registro ni crear una fila nueva

#### Scenario: Proveedor inválido
- **WHEN** falta la PK requerida por la acción o el nombre, `Activo` no es booleano, la hoja contiene PK duplicada o el objetivo de actualización no existe
- **THEN** la API responde con error y no modifica el registro de proveedores

### Requirement: Libro mayor inmutable y esquema estable
La planilla operativa MUST contener `Movimientos_Stock` con los encabezados `Movimiento_Id`, `Fecha`, `Id_Producto`, `Tipo`, `Cantidad`, `Costo_Unitario`, `Referencia`, `Nota`, `Id_Pedido`, `Item_Id` y `Clave_Idempotencia`. Cada alta MUST generar en servidor un `Movimiento_Id` no vacío y único y una fecha-hora; MUST preservar el movimiento como una fila inmutable; y MUST impedir acciones de edición o borrado. Toda rectificación MUST agregarse como un movimiento nuevo relacionado mediante `Referencia`. La creación de la hoja y sus encabezados MUST ocurrir únicamente dentro de una operación explícita de escritura o inicialización protegida por `LockService`; una lectura MUST NOT crear, congelar ni modificar hojas o encabezados.

#### Scenario: Creación de la hoja
- **WHEN** una primera escritura válida e inicializada bajo `LockService` encuentra que `Movimientos_Stock` no existe
- **THEN** se crea la hoja con los encabezados definidos sin alterar otras hojas

#### Scenario: Inicialización serializada
- **WHEN** dos primeras escrituras compiten por inicializar `Movimientos_Stock`
- **THEN** el lock serializa la comprobación y se crea una única hoja con una única fila de encabezados

#### Scenario: Movimiento confirmado
- **WHEN** una alta válida finaliza
- **THEN** queda una sola fila con identificador y fecha-hora generados por servidor que no puede editarse ni borrarse mediante la API

#### Scenario: Rectificación de antecedente
- **WHEN** se necesita corregir un movimiento confirmado y `Referencia` identifica un movimiento previo del mismo producto
- **THEN** se agrega una `CORRECCION` con nota y referencia al movimiento antecedente sin modificar la fila original

### Requirement: Validación de movimientos y cantidades firmadas
El escritor de movimientos MUST admitir únicamente `INGRESO`, `VENTA`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION`. `INGRESO` MUST tener cantidad finita mayor que cero y costo unitario finito no negativo; `VENTA`, `CONSUMO_PROPIO` y `ROTURA_MERMA` MUST tener cantidad finita menor que cero; y `CORRECCION` MUST tener cantidad finita distinta de cero, nota no vacía y una `Referencia` que resuelva a un `Movimiento_Id` ya existente del mismo `Id_Producto`. Una referencia ausente, inexistente, futura, propia o perteneciente a otro producto MUST ser rechazada. Todo movimiento MUST referenciar un producto existente con `Gestiona_Stock = true`. La API manual MUST admitir `INGRESO`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION`, pero MUST rechazar `VENTA`, que queda reservada al escritor interno para C-03. Una validación fallida MUST dejar el libro mayor sin cambios.

#### Scenario: Ingreso válido
- **WHEN** el admin registra un ingreso positivo con costo no negativo para un producto de consignación o stock propio
- **THEN** el sistema agrega un `INGRESO` sin modificar el costo de catálogo ni registrar `Proveedor_Efectivo`

#### Scenario: Salida manual válida
- **WHEN** el admin registra una cantidad negativa de `CONSUMO_PROPIO` o `ROTURA_MERMA` para un producto con stock gestionado
- **THEN** el sistema agrega exactamente una salida del tipo solicitado

#### Scenario: Corrección negativa válida
- **WHEN** el admin registra una `CORRECCION` negativa con nota y referencia a un movimiento previo del mismo producto
- **THEN** el sistema agrega la corrección y conserva el antecedente intacto

#### Scenario: Antecedente de corrección inválido
- **WHEN** una `CORRECCION` omite la referencia o apunta a un identificador inexistente, propio, futuro o de otro producto
- **THEN** la API rechaza el movimiento y el libro mayor permanece sin cambios

#### Scenario: Venta intentada por la acción manual
- **WHEN** un cliente de la API invoca el alta manual con tipo `VENTA`
- **THEN** la API rechaza el payload y no escribe movimientos

#### Scenario: Producto sin stock gestionado
- **WHEN** se intenta registrar un movimiento para un producto contra pedido o histórico no clasificado
- **THEN** se rechaza la operación y el saldo permanece sin cambios

#### Scenario: Payload inválido
- **WHEN** el tipo no está admitido, el producto no existe, la cantidad es nula o tiene signo inválido, el costo de ingreso es inválido o una corrección carece de nota o referencia
- **THEN** la API devuelve un error descriptivo y no agrega ninguna fila

### Requirement: Saldo derivado exclusivamente de movimientos
La acción administrativa de resumen MUST ser una lectura pura y devolver por producto su identificador, proveedor habitual, modalidad, condición derivada `Gestiona_Stock`, `Sin_Stock` y saldo. Antes de calcular, MUST exigir que `Movimientos_Stock` ya exista y validar todas sus filas; si la hoja falta o cualquier fila incumple el contrato de encabezados, identificador, producto, tipo, cantidad, costo, referencia o idempotencia, `resumenStock` MUST fallar de forma cerrada, devolver un error explícito y MUST NOT crear la hoja, escribir encabezados ni devolver balances parciales. Para productos con stock gestionado, el saldo MUST ser la suma algebraica de todas las cantidades válidas de `Movimientos_Stock`; para productos contra pedido o históricos no clasificados, el saldo MUST ser `null` y MUST NOT inferirse de pedidos, catálogo ni otra cifra editable. Un saldo cero o negativo MUST NOT cambiar `Sin_Stock`, bloquear ventas ni disparar alertas.

#### Scenario: Ledger ausente durante una lectura
- **WHEN** el admin solicita `resumenStock` antes de que exista `Movimientos_Stock`
- **THEN** la API falla de forma cerrada sin crear la hoja, escribir encabezados, congelar filas ni modificar la planilla

#### Scenario: Secuencia mixta
- **WHEN** un producto registra ingreso `+10`, venta `-3`, consumo propio `-1`, rotura/merma `-2` y corrección `+1`
- **THEN** el resumen devuelve saldo `5`

#### Scenario: Producto gestionado sin movimientos
- **WHEN** un producto de consignación o stock propio no tiene movimientos
- **THEN** el resumen devuelve saldo `0`

#### Scenario: Producto contra pedido
- **WHEN** un producto está clasificado como `CONTRA_PEDIDO` o no tiene clasificación histórica
- **THEN** el resumen devuelve `Gestiona_Stock = false` y saldo `null`

#### Scenario: Saldo cero independiente de disponibilidad
- **WHEN** el saldo calculado es cero y `Sin_Stock = false`
- **THEN** el resumen conserva `Sin_Stock = false` y no genera reserva, bloqueo ni alerta

#### Scenario: Saldo negativo auditable
- **WHEN** la suma algebraica produce un saldo negativo
- **THEN** el resumen muestra ese saldo sin borrar movimientos ni corregirlo automáticamente

#### Scenario: Fila malformada en el ledger
- **WHEN** cualquier fila de `Movimientos_Stock` incumple el contrato del libro mayor
- **THEN** el resumen responde con un error explícito y no devuelve ningún saldo parcial

### Requirement: Escritura serializada e idempotencia de ventas preparada para C-03
Toda escritura de proveedores o movimientos MUST ejecutarse dentro de `LockService`. Todo valor no vacío de `Clave_Idempotencia` MUST ser único en `Movimientos_Stock`. El escritor interno de `VENTA` MUST exigir `Id_Pedido`, `Item_Id`, cantidad negativa y la clave exacta `VENTA:<Id_Pedido>:<Item_Id>`. Si la misma clave y el mismo contenido ya existen, MUST devolver el movimiento existente como reintento idempotente; si la clave existe con contenido incompatible, MUST rechazar el intento. C-02 MUST preparar este escritor pero MUST NOT conectarlo a guardado de pedidos ni a la transición `Entregado`; esa integración pertenece a C-03.

#### Scenario: Dos ingresos concurrentes
- **WHEN** dos solicitudes válidas de ingreso compiten por escribir
- **THEN** el lock serializa las altas y ambas obtienen identificadores únicos sin filas parciales

#### Scenario: Reintento de venta idéntica
- **WHEN** el escritor interno recibe dos veces la misma venta con clave `VENTA:42:ITEM-2` y contenido idéntico
- **THEN** existe como máximo una fila y el segundo intento devuelve el movimiento ya registrado

#### Scenario: Colisión incompatible
- **WHEN** una clave idempotente existente se reutiliza con otro producto, pedido, ítem, tipo o cantidad
- **THEN** el intento se rechaza y el libro mayor no cambia

#### Scenario: Pedido entregado durante C-02
- **WHEN** se guarda o cambia un pedido a `Entregado` antes de implementar C-03
- **THEN** C-02 no crea ningún movimiento de venta

### Requirement: Respuestas atómicas y compatibles con la API existente
Las nuevas acciones MUST integrarse en los `doGet` y `doPost` existentes y MUST conservar el sobre JSON `{ ok: true, ... }` para éxito y `{ ok: false, error: ... }` para error. Una solicitud MUST validar por completo antes de escribir y MUST NOT dejar filas parciales cuando falle. Las acciones existentes de pedidos, clientes, contactos y códigos promocionales MUST conservar su comportamiento.

#### Scenario: Solicitud válida
- **WHEN** una nueva acción administrativa termina correctamente
- **THEN** la respuesta usa `ok: true` y contiene sólo el resultado de esa acción

#### Scenario: Solicitud rechazada
- **WHEN** una nueva acción falla validación o acceso a una hoja requerida
- **THEN** la respuesta usa `ok: false`, incluye un error entendible y no deja una escritura parcial

#### Scenario: Acción preexistente
- **WHEN** se invoca una acción de pedidos, clientes, contactos o códigos promocionales existente
- **THEN** conserva su contrato anterior

### Requirement: Exclusión de datos operativos de superficies públicas
El workflow de catálogo MUST excluir de `shared/catalogo.json` los costos, los datos y claves de proveedores, `Productos.Id_Proveedor`, `Modalidad_Abastecimiento`, movimientos y cualquier otro campo operativo privado. B2C y B2B MUST NOT consultar las nuevas acciones administrativas ni recibir esos datos. `Sin_Stock` MAY publicarse únicamente en un change posterior; C-02 MUST mantener sin cambios su comportamiento público. El JSON reducido del admin MAY conservar el costo ya requerido por la operación actual, pero MUST NOT incorporar teléfonos, direcciones, notas de proveedores ni movimientos. Las nuevas acciones usan el deployment y el nivel de protección actual: son de uso administrativo, pero C-02 MUST NOT describirlas como autenticación fuerte ni como garantía de confidencialidad.

#### Scenario: Generación del catálogo completo
- **WHEN** el workflow genera `shared/catalogo.json` después de materializar los nuevos campos
- **THEN** ninguna rama de productos o precios contiene costos, datos o claves de proveedores, FK privada, modalidad ni movimientos

#### Scenario: Catálogo reducido del admin
- **WHEN** el workflow genera `admin/productos.json`
- **THEN** puede conservar el costo operativo existente pero no contiene registros de proveedores, sus datos de contacto o notas, ni movimientos

#### Scenario: Consumo desde B2C o B2B
- **WHEN** una persona usa cualquiera de los sitios públicos
- **THEN** el sitio no llama las acciones de proveedores, resumen de stock o movimientos y no muestra sus datos

#### Scenario: Alcance de la protección actual
- **WHEN** se documenta o comunica la API de C-02
- **THEN** se la identifica como orientada al admin sobre el deployment actual y no como una API con autenticación o seguridad fuerte

### Requirement: Alcance operativo deliberadamente limitado
C-02 MUST NOT realizar backfill de pedidos, ítems o movimientos históricos; MUST NOT crear movimientos retrospectivos; y MUST NOT implementar reservas, stock en tiempo real, alertas de reposición, lotes, vencimientos, pagos a proveedores, liquidaciones de consignación ni `Proveedor_Efectivo`. Los movimientos MUST NOT interpretarse como cobros ni modificar Finanzas.

La verificación productiva del deployment de C-02 MUST limitarse a lecturas y MUST NOT crear proveedores, clasificaciones o movimientos sintéticos. La cobertura automatizada de `LockService` e idempotencia MUST conservarse, pero MUST NOT describirse como prueba de concurrencia productiva real. La prueba con escrituras concurrentes reales MUST ejecutarse recién en el piloto integrado C-07.

#### Scenario: Smoke productivo de C-02
- **WHEN** se verifica el deployment de C-02 antes del piloto integrado
- **THEN** sólo se consultan acciones de lectura, no se realizan escrituras sintéticas y la evidencia automatizada de locks no se presenta como concurrencia productiva real

#### Scenario: Historial previo
- **WHEN** existen pedidos o ítems anteriores sin snapshot de abastecimiento
- **THEN** permanecen legibles y no generan movimientos ni reciben backfill

#### Scenario: Movimiento de venta futuro
- **WHEN** C-03 registre una venta de un pedido entregado
- **THEN** el movimiento afectará únicamente el saldo físico y no probará ni registrará un cobro

#### Scenario: Funcionalidad fuera de alcance
- **WHEN** el saldo queda bajo, hay mercadería consignada o existe información de proveedor efectivo
- **THEN** C-02 no genera alertas, liquidaciones, pagos, lotes, vencimientos ni registros adicionales fuera del libro mayor aprobado
