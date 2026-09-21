## Purpose

Establecer un contrato auditable y compatible con el histórico que separe abastecimiento, disponibilidad pública, saldo físico y registro financiero antes de modificar la operación.

## ADDED Requirements

### Requirement: Preservación de códigos legacy del producto
Los valores actuales de `Productos.Id_Proveedor` y `Precios.Id_proveedor` MUST tratarse como códigos externos/SKUs del producto en el proveedor actual y MUST NOT reinterpretarse como identidad de proveedor habitual. Antes de introducir el nuevo significado de `Productos.Id_Proveedor`, la migración MUST preservar exactamente ambos conjuntos de valores bajo el concepto `Codigo_Proveedor`, MUST verificar igualdad antes/después y MUST abortar si detecta pérdida o modificación.

#### Scenario: Preservación del campo legacy de Productos
- **WHEN** se migra el actual `Productos.Id_Proveedor`
- **THEN** cada valor se conserva exactamente como `Productos.Codigo_Proveedor` y no se usa como FK de proveedor

#### Scenario: Preservación del campo legacy de Precios
- **WHEN** se migra el actual `Precios.Id_proveedor`
- **THEN** cada valor se conserva exactamente como `Precios.Codigo_Proveedor` y no se usa como FK de proveedor

#### Scenario: Diferencia detectada durante la migración
- **WHEN** la comparación antes/después detecta un valor omitido, modificado o asociado a otra fila
- **THEN** la migración se detiene antes de crear el nuevo `Productos.Id_Proveedor`

#### Scenario: Código con forma de identificador de proveedor
- **WHEN** un código legacy coincide textual o visualmente con una nueva PK de proveedor
- **THEN** el sistema mantiene ambos conceptos separados y no infiere una relación entre ellos

### Requirement: Registro privado de proveedores
La planilla operativa MUST contener una entidad privada `Proveedores` con `Id_Proveedor` como PK estable, no vacía y única; `Nombre` requerido; `Telefono` opcional; `Direccion` opcional; `Activo` booleano requerido; y `Notas` opcional. Las claves iniciales MUST ser aportadas y aprobadas explícitamente por el responsable; el sistema MUST NOT inventarlas ni derivarlas de códigos legacy. Ningún campo de `Proveedores` MUST publicarse en el catálogo, y los artefactos, ejemplos, fixtures, pruebas y logs MUST NOT contener teléfonos, direcciones u otros datos personales reales.

#### Scenario: Alta válida en el registro privado
- **WHEN** se define un proveedor con una PK aprobada y única, nombre y estado booleano
- **THEN** el registro satisface el contrato privado aunque los campos opcionales estén vacíos

#### Scenario: PK ausente o duplicada
- **WHEN** un registro de `Proveedores` tiene `Id_Proveedor` vacío o repetido
- **THEN** el contrato rechaza el registro sin alterar otros proveedores

#### Scenario: Generación del catálogo público
- **WHEN** se genera cualquier representación pública del catálogo
- **THEN** se excluyen la entidad operativa `Proveedores`, sus campos y las FK privadas de productos

#### Scenario: Validación sin datos personales reales
- **WHEN** se documenta o prueba el contrato de proveedores
- **THEN** se usan únicamente valores sintéticos sin teléfonos, direcciones ni personas reales

### Requirement: FK privada de proveedor habitual y metadatos controlados
Sólo después de preservar y renombrar los campos legacy, la entidad `Productos`, que MUST permanecer en la planilla de catálogo, MUST incorporar allí un nuevo `Id_Proveedor` como FK privada a `Proveedores.Id_Proveedor`, cuya entidad MUST vivir exclusivamente en la planilla operativa privada. La FK y todos los datos de `Proveedores` MUST quedar excluidos del JSON público, y C-02 MUST materializar técnicamente la FK y esa exclusión. Desde la implementación del contrato, cada producto nuevo o reclasificado MUST tener una FK que exista y apunte a un proveedor activo, `Modalidad_Abastecimiento` y `Sin_Stock`. La modalidad MUST ser exactamente `CONTRA_PEDIDO`, `CONSIGNACION` o `STOCK_PROPIO`, y `Sin_Stock` MUST ser booleano. Los productos históricos aún no reclasificados MUST conservarse sin backfill automático y, hasta su clasificación explícita, MUST interpretarse como `CONTRA_PEDIDO`, sin stock gestionado y con `Sin_Stock = false` para mantener el comportamiento vigente. El admin MUST resolver los datos del proveedor mediante join por la FK, sin duplicarlos en Productos.

#### Scenario: Producto nuevo con valores válidos
- **WHEN** se incorpora o reclasifica un producto con `Productos.Id_Proveedor` incluido en la lista controlada, modalidad admitida y `Sin_Stock` booleano
- **THEN** el contrato acepta sus metadatos de abastecimiento

#### Scenario: Producto con valor no controlado
- **WHEN** un producto nuevo usa un proveedor fuera de la lista aprobada, una modalidad diferente de las tres admitidas o un valor no booleano para `Sin_Stock`
- **THEN** el contrato rechaza el registro y no publica esa configuración

#### Scenario: Producto histórico sin clasificación
- **WHEN** se lee un producto creado antes de incorporar los campos de abastecimiento
- **THEN** se conserva el registro sin completarlo y se lo interpreta de manera compatible como contra pedido, sin stock gestionado y disponible

#### Scenario: Proveedor inexistente
- **WHEN** un producto nuevo o reclasificado referencia un `Id_Proveedor` que no existe en `Proveedores`
- **THEN** el contrato rechaza la configuración y reporta una FK inexistente

#### Scenario: Proveedor inactivo
- **WHEN** un producto nuevo o reclasificado referencia un proveedor con `Activo = false`
- **THEN** el contrato rechaza la configuración para nueva operación y reporta el proveedor inactivo

#### Scenario: Join administrativo privado
- **WHEN** el admin necesita mostrar el proveedor habitual de un producto
- **THEN** resuelve `Productos.Id_Proveedor` contra `Proveedores.Id_Proveedor` sin publicar ni copiar los datos privados al catálogo

### Requirement: Responsabilidades separadas por change
C-01 MUST limitarse al contrato, la migración controlada de campos legacy y los criterios de integridad. C-02 MUST implementar la lectura y escritura privada de `Proveedores`, las FK y los movimientos mediante Apps Script. C-04 MUST implementar en admin el CRUD de `Proveedores` y los joins por `Id_Proveedor`. C-01 MUST NOT implementar las responsabilidades asignadas a C-02 o C-04.

#### Scenario: Aplicación de C-01
- **WHEN** se ejecutan las tareas de C-01
- **THEN** se define y valida la migración y la integridad sin agregar endpoints de Apps Script ni CRUD administrativo

#### Scenario: Handoff a C-02
- **WHEN** C-02 consume el contrato aprobado
- **THEN** implementa la lectura y escritura privada sin exponer `Proveedores`, FK, costos o movimientos al catálogo público

#### Scenario: Handoff a C-04
- **WHEN** C-04 consume el contrato aprobado
- **THEN** implementa el CRUD y los joins administrativos sin convertir esos datos en contenido público

### Requirement: Disponibilidad global independiente del saldo físico
`Sin_Stock` MUST ser una decisión manual y global para los canales públicos. Cuando vale `true`, el sistema MUST impedir iniciar nuevas ventas del producto tanto en B2C como en B2B sin modificar `Activo`; cuando vale `false`, un saldo físico de cero MUST NOT bloquear por sí solo la venta. El único dato de este contrato que MAY alcanzar el catálogo público es `Sin_Stock`; proveedor, modalidad, costos y movimientos MUST permanecer internos.

#### Scenario: Bloqueo manual global
- **WHEN** el responsable establece `Sin_Stock = true` para un producto activo
- **THEN** el producto permanece catalogado pero no admite nuevas ventas en B2C ni B2B

#### Scenario: Saldo cero con reposición posible
- **WHEN** un producto tiene saldo físico igual a cero y `Sin_Stock = false`
- **THEN** el saldo no cambia automáticamente la disponibilidad pública del producto

#### Scenario: Datos internos fuera del catálogo
- **WHEN** se genera una representación pública del catálogo
- **THEN** puede incluir `Sin_Stock` pero excluye proveedor habitual, modalidad interna, costos y movimientos de stock

### Requirement: Snapshot de abastecimiento por ítem
Cada ítem de un pedido nuevo MUST congelar un `Item_Id` estable y único dentro del pedido, `Id_Proveedor`, `Modalidad_Abastecimiento` y `Gestiona_Stock` al momento de guardarse. `Gestiona_Stock` MUST ser `false` para `CONTRA_PEDIDO` y `true` para `CONSIGNACION` o `STOCK_PROPIO`. Los cambios posteriores del catálogo MUST NOT reinterpretar el snapshot. Los pedidos o ítems históricos sin snapshot MUST permanecer legibles, MUST NOT recibir backfill y MUST NOT generar movimientos automáticos o retrospectivos hasta ser tratados explícitamente.

#### Scenario: Pedido con modalidades mixtas
- **WHEN** se guarda un pedido con líneas contra pedido, en consignación y de stock propio
- **THEN** cada línea conserva su propio proveedor, modalidad y condición de gestión de stock

#### Scenario: Cambio posterior del catálogo
- **WHEN** cambia el proveedor habitual o la modalidad de un producto después de guardar un pedido
- **THEN** los ítems ya guardados conservan los valores congelados originalmente

#### Scenario: Ítem histórico sin snapshot
- **WHEN** se procesa un pedido anterior al contrato cuyos ítems no tienen snapshot
- **THEN** el pedido sigue siendo legible pero no produce movimientos automáticos de inventario

### Requirement: Libro mayor inmutable de stock
El saldo físico de cada producto con stock gestionado MUST derivarse exclusivamente de movimientos inmutables. Cada movimiento MUST tener `Movimiento_Id`, fecha y hora, `Id_Producto`, tipo, cantidad firmada no nula, costo unitario no negativo cuando corresponda, referencia y nota; y MAY incluir `Id_Pedido`, `Item_Id` y `Clave_Idempotencia` según su origen. Los tipos admitidos MUST ser `INGRESO`, `VENTA`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION`. `INGRESO` MUST usar cantidad positiva; `VENTA`, `CONSUMO_PROPIO` y `ROTURA_MERMA`, cantidad negativa; `CORRECCION`, cualquier cantidad distinta de cero y nota obligatoria. Un movimiento confirmado MUST NOT editarse ni borrarse; toda rectificación MUST registrarse como otro movimiento relacionado. Cada ingreso MUST conservar su costo real cuando corresponda, pero el contrato MUST NOT modelar `Proveedor_Efectivo` ni proveedores alternativos por movimiento.

#### Scenario: Cálculo con movimientos mixtos
- **WHEN** un producto registra ingresos y salidas válidas de distintos tipos
- **THEN** su saldo es la suma algebraica de las cantidades firmadas de todos sus movimientos

#### Scenario: Corrección trazable
- **WHEN** se necesita rectificar un movimiento confirmado
- **THEN** se registra una `CORRECCION` no nula con nota y referencia al antecedente sin alterar el movimiento original

#### Scenario: Movimiento inválido
- **WHEN** se intenta registrar una salida con signo positivo, una corrección sin nota o un tipo no admitido
- **THEN** el contrato rechaza el movimiento sin alterar el libro mayor

#### Scenario: Costo real de ingreso
- **WHEN** se registra un `INGRESO` de consignación o stock propio
- **THEN** el movimiento conserva su costo unitario real no negativo sin sobrescribir el costo de catálogo ni el proveedor habitual y sin registrar `Proveedor_Efectivo`

### Requirement: Venta automática únicamente al entregar
La transición efectiva de un pedido hacia `Entregado` MUST ser el único hito que genera automáticamente movimientos `VENTA`, y MUST hacerlo sólo para ítems cuyo snapshot tenga `Gestiona_Stock = true`. Cada movimiento `VENTA` automático MUST incluir el campo `Clave_Idempotencia` con el valor exacto `VENTA:<Id_Pedido>:<Item_Id>`, y todo valor no vacío de ese campo MUST ser único dentro de `Movimientos_Stock`. Guardar nuevamente o reintentar el mismo pedido entregado MUST consultar esa clave y MUST NOT duplicar el movimiento. `Medio_Pago` MUST NOT iniciar, impedir ni confirmar movimientos de inventario y el movimiento de venta MUST NOT considerarse prueba de cobro.

#### Scenario: Entrega de pedido mixto
- **WHEN** un pedido con líneas gestionadas y contra pedido pasa por primera vez a `Entregado`
- **THEN** se crea una sola `VENTA` negativa por cada línea gestionada con `Clave_Idempotencia = VENTA:<Id_Pedido>:<Item_Id>` y ninguna por las líneas contra pedido

#### Scenario: Reguardado idempotente
- **WHEN** se guarda nuevamente un pedido entregado cuyos movimientos de venta ya existen
- **THEN** se encuentra la `Clave_Idempotencia` existente y no se crea ningún movimiento duplicado

#### Scenario: Reintento concurrente con clave repetida
- **WHEN** dos intentos buscan crear una venta automática con la misma `Clave_Idempotencia`
- **THEN** la restricción de unicidad acepta como máximo un movimiento y el otro intento no altera el libro mayor

#### Scenario: Estado previo o cancelado
- **WHEN** un pedido se guarda en cualquier estado distinto de `Entregado`, incluso `Cancelado`
- **THEN** no se crea un movimiento automático de venta

#### Scenario: Medio de pago sin efecto de inventario
- **WHEN** se cambia o completa `Medio_Pago`
- **THEN** el inventario no se modifica y Finanzas continúa siendo el registro operativo de cobros reales

### Requirement: Excepciones posteriores preservan trazabilidad
Después de aplicar una venta, el sistema MUST impedir modificar silenciosamente el producto, la cantidad o la condición de stock del ítem aplicado. Una devolución, rechazo, sustitución, corrección de cantidad o reversión de estado MUST resolverse mediante movimientos adicionales explícitos con referencia al pedido, ítem y movimiento original; MUST NOT borrar ni reescribir la venta ya registrada.

#### Scenario: Edición posterior de cantidad
- **WHEN** se intenta cambiar la cantidad de un ítem que ya generó una venta
- **THEN** la edición directa se rechaza y se requiere un ajuste trazable mediante movimiento adicional

#### Scenario: Rechazo o devolución después de entregar
- **WHEN** una línea entregada vuelve físicamente al stock gestionado
- **THEN** se registra una corrección positiva referenciada sin eliminar la venta original

#### Scenario: Pedido histórico reclasificado
- **WHEN** el responsable decide incorporar al inventario un pedido histórico sin snapshot
- **THEN** la regularización se realiza mediante movimientos explícitos y documentados, no mediante inferencia automática del catálogo vigente
