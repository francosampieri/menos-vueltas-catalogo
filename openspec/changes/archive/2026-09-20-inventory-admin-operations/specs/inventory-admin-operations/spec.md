## Purpose

Permitir al equipo operar proveedores e inventario desde admin privado, con saldos auditables y sin trasladar datos operativos o personales a las superficies públicas.

## ADDED Requirements

### Requirement: Gestión privada de proveedores con baja lógica
El panel administrativo MUST permitir listar, crear y actualizar proveedores mediante las acciones privadas aprobadas. Para continuidad operativa, la baja desde el panel MUST cambiar explícitamente `Activo` a `false`; el panel MUST NOT ofrecer borrado físico ni cambio de `Id_Proveedor`. Al crear, MUST solicitar un `Id_Proveedor` estable y único, `Nombre` y `Activo`; al editar, MUST conservar inmutable el identificador y permitir actualizar sólo los demás campos del contrato. Teléfono, dirección y notas MUST quedar restringidos al admin privado y MUST NOT aparecer en catálogo, sitios públicos, historial de inventario, pruebas, ejemplos ni logs.

#### Scenario: Alta y edición privadas válidas
- **WHEN** una persona operadora guarda un proveedor con identificador nuevo, nombre no vacío y estado booleano, o edita sus campos mutables con un identificador original válido
- **THEN** el panel confirma exactamente el proveedor guardado sin crear una fila duplicada ni publicar sus datos privados

#### Scenario: Baja lógica
- **WHEN** una persona operadora solicita desactivar un proveedor existente y confirma la acción
- **THEN** el panel actualiza únicamente `Activo` a `false`, conserva el registro y no ofrece borrarlo físicamente

#### Scenario: Proveedor inválido
- **WHEN** se intenta guardar un identificador vacío, duplicado o mutado, un nombre vacío o un estado que no es booleano
- **THEN** el panel muestra el error de validación y no comunica éxito ni cambia otro proveedor

### Requirement: Clasificación administrativa de abastecimiento por producto
El panel administrativo MUST permitir que una persona operadora clasifique un producto con un proveedor habitual, una modalidad exacta `CONTRA_PEDIDO`, `CONSIGNACION` o `STOCK_PROPIO` y un valor booleano de `Sin_Stock`. Antes de guardar, MUST utilizar la acción privada de clasificación y rechazar una FK inexistente, inactiva o una modalidad o valor inválido. Para un producto histórico sin clasificación, el panel MUST mostrar la interpretación compatible de contra pedido, sin stock gestionado y `Sin_Stock = false`, sin completar ni persistir valores automáticamente. La clasificación MUST ser metadato operativo global del producto y MUST NOT modificar precios, reglas comerciales, clientes ni datos propios de B2C o B2B.

#### Scenario: Clasificación válida
- **WHEN** una persona operadora asigna a un producto un proveedor activo existente, una de las tres modalidades admitidas y un valor booleano de `Sin_Stock`
- **THEN** el panel confirma la clasificación privada y permite que la vista de inventario la muestre para ese producto

#### Scenario: Clasificación con proveedor inactivo o valor no permitido
- **WHEN** una persona operadora intenta guardar un proveedor inexistente o inactivo, una modalidad fuera del conjunto controlado o un `Sin_Stock` no booleano
- **THEN** el panel informa el rechazo y la clasificación persistida del producto permanece sin cambios

#### Scenario: Producto histórico no clasificado
- **WHEN** el panel consulta un producto creado antes de los metadatos de abastecimiento
- **THEN** lo presenta sin stock gestionado y con saldo no aplicable, sin escribir una reclasificación ni marcarlo sin stock

### Requirement: Vista administrativa de saldo y disponibilidad manual
El panel MUST mostrar una vista de inventario que lea el resumen privado y, por producto, presente saldo calculado, proveedor habitual, modalidad, `Gestiona_Stock` y `Sin_Stock`. Para consignación y stock propio, el saldo MUST ser el resultado algebraico del libro mayor; para contra pedido o un histórico no clasificado, el saldo MUST mostrarse como no aplicable y MUST NOT reemplazarse por cero ni por una cifra editable. Un saldo cero o negativo MUST conservar el valor actual de `Sin_Stock` y MUST NOT crear alerta, reserva, reposición, bloqueo ni cambio automático de disponibilidad. Cuando una misma superficie administrativa distingue canales, MUST conservar B2C y B2B separados y MUST NOT mezclar clientes, precios, pedidos ni métricas de ambos canales.

#### Scenario: Saldo físico cero con producto disponible
- **WHEN** el resumen de un producto con stock gestionado devuelve saldo `0` y `Sin_Stock = false`
- **THEN** la vista muestra ambos valores sin cambiar la clasificación, generar una alerta ni inferir que el producto está agotado

#### Scenario: Producto contra pedido
- **WHEN** el resumen devuelve un producto `CONTRA_PEDIDO` con `Gestiona_Stock = false` y saldo `null`
- **THEN** la vista presenta el saldo como no aplicable y no habilita un movimiento de stock para ese producto

#### Scenario: Separación de canales en admin
- **WHEN** una persona operadora consulta la vista desde un contexto B2C o B2B
- **THEN** el panel conserva el canal y sus datos comerciales separados, sin usar el saldo físico para combinar pedidos, clientes, precios o métricas entre canales

### Requirement: Registro manual acotado de movimientos físicos
El panel MUST permitir registrar únicamente `INGRESO`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION` para productos con stock gestionado, mediante la acción privada del libro mayor. Para un ingreso, MUST solicitar una cantidad positiva y un costo unitario finito no negativo; ese costo real MUST NOT sobrescribir el costo o precio público del catálogo ni el proveedor habitual. Para consumo propio y rotura/merma, MUST serializar una cantidad negativa. Para corrección, MUST solicitar una cantidad distinta de cero, nota y referencia a un movimiento anterior del mismo producto. El panel MUST NOT ofrecer ni enviar una venta manual: `VENTA` queda reservada exclusivamente a la transición efectiva a `Entregado` de C-03. Antes del primer envío de un movimiento manual, el panel MUST asignarle una `Clave_Idempotencia` nueva fuera del espacio `VENTA:` y MUST conservar exactamente esa clave y payload para reintentar tras un error de red o una respuesta incierta. Sólo una nueva intención explícita de la persona operadora puede generar una clave nueva. Cada confirmación MUST usar la respuesta del servidor como fuente de éxito.

#### Scenario: Ingreso válido
- **WHEN** una persona operadora confirma un ingreso válido para un producto de consignación o stock propio
- **THEN** el panel registra exactamente un `INGRESO` y el saldo posterior incorpora esa cantidad, sin alterar proveedor habitual ni precios de catálogo

#### Scenario: Salida manual válida
- **WHEN** una persona operadora confirma una cantidad negativa de consumo propio o rotura/merma para un producto con stock gestionado
- **THEN** el panel registra exactamente una salida del tipo seleccionado y muestra el resultado confirmado por el servidor

#### Scenario: Corrección trazable
- **WHEN** una persona operadora registra una corrección con cantidad no nula, nota y referencia válida a un movimiento previo del mismo producto
- **THEN** el panel agrega una nueva corrección y conserva visible el movimiento antecedente sin editarlo ni borrarlo

#### Scenario: Venta manual o movimiento inválido
- **WHEN** una persona operadora intenta enviar `VENTA`, operar un producto sin stock gestionado o confirmar un payload con signo, costo, nota o referencia inválidos
- **THEN** el panel muestra el error y no informa un movimiento creado ni modifica el saldo mostrado como confirmado

#### Scenario: Reintento manual incierto
- **WHEN** falla o se pierde la respuesta del primer envío de un movimiento manual y la persona operadora elige reintentarlo
- **THEN** el panel reenvía la misma clave y el mismo payload, reconoce el movimiento existente si el servidor lo devuelve y no crea una segunda fila

### Requirement: Historial privado y no personal de movimientos
El panel MUST ofrecer una consulta de sólo lectura del historial de `Movimientos_Stock`, ordenada de más reciente a más antigua. Para el volumen actual, la consulta MUST devolver el historial válido completo y MAY aplicar filtros simples por producto y tipo de movimiento; no incorpora paginación, dashboard ni agregados. Cada entrada MUST devolver `Movimiento_Id`, fecha-hora, producto, tipo, cantidad firmada, costo unitario cuando corresponda, nota, referencia, `Id_Pedido` e `Item_Id` sólo cuando existan. La lectura MUST ser pura: no crea hojas, encabezados, movimientos ni backfills. La vista MUST NOT unir el historial con pedidos, clientes, contactos o Finanzas, ni mostrar nombres, teléfonos, direcciones, barrios, medios de pago u otros datos personales de clientes; una referencia de pedido se limita a su identificador operativo.

#### Scenario: Historial con referencia de pedido
- **WHEN** existe una venta creada automáticamente por una entrega y una persona operadora consulta el historial
- **THEN** la vista muestra el movimiento y su `Id_Pedido` e `Item_Id` operativos sin mostrar ni resolver datos de cliente o de cobro

#### Scenario: Consulta filtrada
- **WHEN** una persona operadora consulta el historial por un producto o tipo permitido
- **THEN** la vista devuelve todos los movimientos válidos que cumplen el filtro, en orden descendente de fecha y sin escribir en la planilla

#### Scenario: Libro mayor ausente o inválido
- **WHEN** la consulta de historial no puede leer un libro mayor existente y válido
- **THEN** el panel informa el error sin crear la hoja, devolver un historial parcial ni presentar datos como confirmados

### Requirement: Límites de alcance, privacidad y publicación
La operación de C-04 MUST permanecer en el admin privado y MUST NOT publicar proveedores, costos, movimientos, `Id_Proveedor` ni `Modalidad_Abastecimiento` en `shared/catalogo.json`, B2C o B2B. La edición administrativa de `Sin_Stock` MUST conservarse como decisión manual global, pero C-04 MUST NOT cambiar todavía la experiencia pública: esa propagación corresponde a C-06. C-04 MUST NOT implementar alertas, reposición automática, reservas, stock en tiempo real, lotes, vencimientos, `Proveedor_Efectivo`, pagos, liquidaciones de consignación ni cambios en Finanzas. Los movimientos físicos MUST NOT presentarse como ventas cobradas ni como registros financieros.

#### Scenario: Operación de inventario completada
- **WHEN** una persona operadora gestiona un proveedor, clasificación, saldo o movimiento desde admin
- **THEN** el resultado queda limitado a la operación privada y no genera publicación en B2C/B2B, actualización de Finanzas, alerta ni flujo automático adicional
