## 1. Aprobación del contrato

- [x] 1.1 Obtener aprobación explícita de los siete puntos de `design.md` §Approval Gates y verificar que cada decisión quede aceptada o devuelta con una modificación concreta antes de tocar capas operativas
- [x] 1.2 Obtener y registrar la lista inicial aprobada de nuevas PK `Proveedores.Id_Proveedor`, y verificar que no se haya inferido ningún ID desde `Productos.Id_Proveedor`, `Precios.Id_proveedor` ni otros códigos legacy
- [x] 1.3 Validar la definición privada de `Proveedores` (`Id_Proveedor`, `Nombre`, `Telefono?`, `Direccion?`, `Activo`, `Notas?`) con ejemplos sintéticos y verificar que ningún artefacto, fixture o prueba contenga datos personales reales

## 2. Migración controlada de identidad

- [x] 2.1 Inventariar por separado encabezados y valores actuales de `Productos.Id_Proveedor` y `Precios.Id_proveedor`, y verificar documentalmente que se tratan como códigos externos/SKUs de producto y nunca como proveedores habituales
- [x] 2.2 Ejecutar la migración de ambos campos legacy a `Codigo_Proveedor`, verificar conteos y valores exactos antes/después y registrar la evidencia; no se materializó la FK privada en C-01
- [x] 2.3 Validar contractualmente con ejemplos sintéticos que el nuevo `Productos.Id_Proveedor` referencia una PK existente y activa de `Proveedores`, y que una FK inexistente o inactiva produce un error de integridad sin publicación de datos privados; entregar la materialización técnica a C-02

## 3. Validación del contrato de inventario

- [x] 3.1 Revisar la matriz de modalidades con ejemplos ficticios para `CONTRA_PEDIDO`, `CONSIGNACION`, `STOCK_PROPIO` e histórico sin snapshot, y verificar que los resultados coincidan con todos los escenarios de la spec
- [x] 3.2 Revisar los contratos de movimiento, signos y corrección con ejemplos ficticios, y verificar que ningún caso requiera editar o borrar un movimiento confirmado ni modele `Proveedor_Efectivo`
- [x] 3.3 Validar contractualmente con dos intentos de la misma venta automática que `Clave_Idempotencia` sea exactamente `VENTA:<Id_Pedido>:<Item_Id>`, que el segundo intento encuentre la clave existente y que una clave duplicada no pueda crear otro movimiento; la prueba ejecutable corresponde a C-02/C-03
- [x] 3.4 Verificar que productos nuevos o reclasificados requieran una FK de proveedor existente y activa, modalidad y `Sin_Stock`, y que no haya backfill de `Items` ni creación retrospectiva de movimientos históricos

## 4. Privacidad y handoffs

- [x] 4.1 Verificar que el contrato público sólo permita `Sin_Stock` y excluya `Productos.Id_Proveedor`, toda la entidad `Proveedores`, modalidad, costos y movimientos; la exclusión técnica de la futura FK queda en C-02
- [x] 4.2 Entregar a C-02 el contrato de lectura/escritura privada de `Proveedores`, FK y movimientos, incluida la unicidad de `Clave_Idempotencia`, sin implementar Apps Script en C-01
- [x] 4.3 Entregar a C-03 el contrato de `Item_Id`, snapshots, transición a `Entregado` y clave exacta de idempotencia, y verificar que los ítems históricos sin snapshot no generen salidas automáticas
- [x] 4.4 Entregar a C-04 el contrato de CRUD administrativo de `Proveedores`, joins por FK y rechazo de proveedores inexistentes o inactivos, sin implementar admin en C-01
- [x] 4.5 Ejecutar `openspec validate supply-and-inventory-data-contract --strict` y verificar que el change quede válido antes de solicitar archive; no ejecutar archive durante apply
