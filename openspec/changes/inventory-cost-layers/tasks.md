# Tasks

## 1. Contrato inmutable de los ingresos

- [x] 1.1 Agregar al contrato privado de `Movimientos_Stock` la columna `Modalidad_Abastecimiento`, obligatoria sólo para `INGRESO` nuevos y con enum exacto `STOCK_PROPIO`/`CONSIGNACION`, sin reordenar ni completar filas históricas; verificar aceptación de ambos valores y rechazo cerrado de vacío, valor ajeno o costo inválido en un ingreso nuevo.
- [x] 1.2 Clasificar un `INGRESO` histórico con modalidad vacía y costo numérico válido como `LEGADO_VALORIZABLE_SIN_MODALIDAD`, sin derivar modalidad actual: conserva costo/FIFO, suma sólo a valor físico conocido y advierte composición incompleta. Documentar como excepción manual ya realizada el asentamiento de `STOCK_PROPIO` en los tres ingresos legado identificados, sin función, endpoint, API ni UI que escriba o complete modalidades históricas. Mantener modalidad y costo ambos vacíos como tramo no valorizable, sin backfill, y rechazar cerradamente costo no numérico, modalidad fuera de enum y demás datos malformados.
- [x] 1.3 Mantener la validación append-only y el saldo algebraico existente al exponer el orden de ledger requerido por la proyección; verificar que una fecha-hora editable no modifica el orden FIFO.

## 2. Proyección pura de tandas y costos

- [x] 2.1 Implementar el reconstructor privado en memoria de tandas por cada `INGRESO`, aun cuando el remanente sea cero, salidas FIFO y asignaciones trazables, sin crear una fuente persistida; verificar con un ledger en memoria de dos ingresos y una salida que cruza ambas tandas, y un ingreso íntegro aplicado a faltantes que permanece sólo en el historial.
- [x] 2.2 Implementar la cola de faltantes pendientes y su cobertura por el ingreso posterior más antiguo aplicable; verificar casos de cobertura parcial y de ingreso con excedente, sin modificar los movimientos de entrada o salida.
- [x] 2.3 Implementar la corrección negativa FIFO y la corrección positiva sólo contra una salida negativa previa del mismo producto, hasta su cantidad neta no revertida; aplicar primero el tramo pendiente y después las capas FIFO valorizadas, restaurando su orden/costo de origen. Verificar reversión parcial, dos reversiones válidas que suman el máximo y rechazo cerrado de doble reversión, referencia faltante, de otro producto, positiva o posterior.
- [x] 2.4 Calcular capital propio y consignación sólo desde sus tandas abiertas valorizables, y valor físico conocido incluyendo el legado valorizable sin modalidad sin atribuirlo a ninguna de aquellas; marcar tramo no valorizable como capital total incompleto y legado sin modalidad como composición histórica incompleta. Verificar que faltantes, históricos sin ingreso y tramos no valorizables no inflan valores.

## 3. Lecturas y presentación privada

- [x] 3.1 Exponer la consulta de valorización como lectura privada, completa o con error cerrado, sin efectos en ledger, precios, `Sin_Stock`, Finanzas, catálogo ni acciones existentes; incluir legado valorizable sin modalidad sólo con su costo/FIFO histórico, sin derivar modalidad actual, y verificar que una lectura inválida no crea hojas, filas ni resultados parciales.
- [x] 3.2 Simplificar la tabla principal de Inventario a Producto, Proveedor, Modalidad, Saldo y Valor total; hacer la fila completa accesible por click/Enter/Espacio, con hover, foco visible y scroll interno móvil sin ampliar body. Mover tandas, FIFO, faltantes, composición e historial al detalle de sólo lectura con etiquetas humanas y sin UUID/códigos técnicos, PII ni cobros. En historial general y selector de antecedente, conservar UUID sólo como valor interno y renderizar ventas/correcciones con sus referencias humanas.
- [x] 3.3 Incorporar el modal de detalle sólo de lectura con tandas abiertas y agotadas, incluidas las de remanente cero que cubrieron faltantes, ingresos origen, asignaciones, correcciones y faltantes; verificar que no ofrece selección ni edición manual de tandas y que no muestra PII, cobros ni datos B2C/B2B.

## 4. Pruebas focalizadas y verificación manual

- [x] 4.1 Ejecutar pruebas focalizadas en memoria, sin planilla temporal, para: FIFO por posición append-only frente a fechas alteradas; agotamiento de tanda; salida que cruza tandas; separación `STOCK_PROPIO`/`CONSIGNACION`; ingreso que cubre íntegramente faltantes pero conserva identidad de tanda; y ausencia de escritura de normalización histórica.
- [x] 4.2 Ejecutar pruebas focalizadas en memoria, sin datos sintéticos productivos, para: legado con modalidad vacía/costo válido que conserva FIFO y suma sólo a valor físico conocido con advertencia de composición incompleta; modalidad y costo vacíos no valorizables; ingreso nuevo malformado rechazado; faltantes parciales y varios faltantes cubiertos en orden. Verificar que no se reescribe ningún movimiento.
- [x] 4.3 Ejecutar pruebas focalizadas en memoria para: corrección negativa, corrección positiva que primero elimina faltante y luego restaura capas, reversión parcial, dos reversiones válidas acumuladas y rechazo de doble reversión o referencia inválida; verificar trazabilidad, costo histórico y saldo neto.
- [ ] 4.4 Verificar manualmente en el entorno privado de desarrollo la tabla, el modal, el historial y el selector de corrección con datos operativos ya existentes sólo en modo lectura, incluyendo una tanda abierta cuya modalidad actual sea `CONTRA_PEDIDO`; confirmar que las referencias visibles no exponen UUID/PII, los saldos existentes se conservan y no se crean movimientos, ingresos iniciales, planillas, despliegues ni publicaciones.

## Evidencia de implementación automatizada

- `node --test tests/admin-promotion.test.js` — 27 pruebas aprobadas para etiquetas de venta, resolución humana de antecedentes de corrección y descripción visible del selector con UUID sólo como valor interno.
- `node --test tests/*.test.js` — 82 pruebas aprobadas; las pruebas C-08 usan sólo ledgers en memoria, incluyendo legado valorizable sin modalidad, FIFO/costo conservado, métricas separadas, advertencia UI y tabla compacta accesible. La excepción manual ya realizada no conserva código ni pruebas de escritura.
- `node --check admin/admin.js`, `Get-Content apps-script/Code.gs | node --check --input-type=commonjs` y `git diff --check` — aprobados.
- La verificación manual 4.4 permanece pendiente de la versión manual de Apps Script y de smoke tests de sólo lectura.
