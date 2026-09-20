## Why

La operación pasará de compra exclusivamente contra pedido a combinar proveedores, consignación y micro-stock, pero hoy no existe un contrato explícito que separe abastecimiento, disponibilidad pública, saldo físico y cobro. Además, los campos actuales `Productos.Id_Proveedor` y `Precios.Id_proveedor` identifican códigos externos/SKUs del producto, no proveedores; definir una migración sin pérdida antes de reutilizar el nombre evita reinterpretar datos existentes, duplicar descuentos de inventario y exponer información interna.

## What Changes

- Preservar íntegramente los valores actuales de `Productos.Id_Proveedor` y `Precios.Id_proveedor` como códigos externos/SKUs de producto, migrándolos de forma controlada a `Codigo_Proveedor` antes de introducir el nuevo significado; esos valores MUST NOT reinterpretarse como proveedores habituales.
- Definir una entidad privada `Proveedores` en la planilla operativa con `Id_Proveedor` como PK estable, `Nombre`, `Telefono` opcional, `Direccion` opcional, `Activo` y `Notas` opcional. La lista inicial aprobada es `DISTROSEC`, `PROCAKE` y `HUEVOS`; no se infirió ningún ID desde códigos legacy ni se inventaron datos adicionales.
- Mantener `Productos` en la planilla de catálogo y definir allí un nuevo `Productos.Id_Proveedor` como FK privada al proveedor habitual en `Proveedores.Id_Proveedor`, cuya entidad vive exclusivamente en la planilla operativa privada, con detección de referencia inexistente o proveedor inactivo. El admin unirá ambas entidades por la clave; ni la FK ni ningún identificador, nombre, teléfono, dirección, nota o dato de proveedor se publicarán en el JSON público.
- Definir valores controlados para `Modalidad_Abastecimiento` (`CONTRA_PEDIDO`, `CONSIGNACION`, `STOCK_PROPIO`) y `Sin_Stock`, sin reutilizar `Activo` como señal de faltante temporal.
- Establecer que `Sin_Stock` es una decisión manual global que bloquea la venta pública; un saldo físico de cero no cambia automáticamente la disponibilidad porque puede existir reposición antes de la entrega.
- Congelar por línea de pedido el proveedor habitual, la modalidad y la condición de gestión de stock vigentes al cargar el pedido, preservando la interpretación histórica.
- Definir un libro mayor inmutable con movimientos de ingreso, venta, consumo propio, rotura/merma y corrección, cantidades firmadas y trazabilidad de producto, costo, fecha, referencia y nota. Cada ingreso conserva el costo real, pero `Proveedor_Efectivo` queda expresamente fuera de alcance.
- Fijar `Entregado` como único hito de descuento automático por venta. Toda venta automática tendrá un campo único `Clave_Idempotencia` con el valor exacto `VENTA:<Id_Pedido>:<Item_Id>`, además del tratamiento explícito de pedidos mixtos y correcciones sin borrar movimientos previos.
- Exigir el nuevo proveedor habitual, modalidad y `Sin_Stock` desde la implementación para productos nuevos o reclasificados, sin backfill de snapshots en `Items` ni creación retrospectiva de movimientos históricos.
- Mantener separado el inventario de la realidad financiera: `Medio_Pago` y el estado del pedido no prueban por sí solos un cobro, cuyo registro operativo continúa en Finanzas.
- Documentar una matriz de reglas y ejemplos ficticios para las tres modalidades antes de cualquier cambio operativo.
- Limitar C-01 al contrato, la migración controlada de nombres/datos y los criterios de integridad; delegar en C-02 la lectura/escritura privada mediante Apps Script y en C-04 el CRUD de proveedores y la unión administrativa.
- No implementar en esta propuesta cambios de Google Sheets, Apps Script, panel administrativo, catálogo web ni knowledge-base; esos cambios requerirán aprobación explícita y changes posteriores.

## Capabilities

### New Capabilities

- `supply-and-inventory-data-contract`: Contrato funcional de metadatos de abastecimiento, disponibilidad global, snapshots por ítem, movimientos inmutables y descuento idempotente al entregar.

### Modified Capabilities

Ninguna; no existen specs OpenSpec previas para modificar.

## Impact

Si se aprueba e implementa, C-01 afectará la estructura de datos mediante una migración controlada: ambos campos legacy conservarán sus valores como `Codigo_Proveedor`, se creará el registro privado `Proveedores` en la planilla operativa privada y sólo después podrá existir el nuevo `Productos.Id_Proveedor` en `Productos`, que permanece en la planilla de catálogo, como FK privada hacia `Proveedores.Id_Proveedor`. C-02 materializará técnicamente esa FK, su lectura/escritura privada y su exclusión del JSON público mediante Apps Script; C-04 afectará el admin para CRUD y joins. Sólo `Sin_Stock` podrá propagarse hacia el catálogo; proveedor habitual, datos de proveedores, modalidad interna, costos y movimientos permanecerán fuera de la superficie pública. La compatibilidad histórica exigirá resolver campos por encabezado, aceptar filas previas sin snapshots y evitar backfills o reinterpretaciones automáticas de `Items` y movimientos. No se introducen frameworks ni dependencias, y esta propuesta no ejecuta todavía esas modificaciones operativas.
