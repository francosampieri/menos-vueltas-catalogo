## Context

Ver [proposal.md](proposal.md) para la motivación. Hoy Sheets es la fuente de verdad; el catálogo se publica como CSV y se materializa en JSON, mientras Pedidos e Items se operan mediante Apps Script. No existe una fuente auditable de saldo físico y el modelo vigente es compra contra pedido. Los cambios futuros deben ser incrementales, resolver columnas por encabezado, preservar filas históricas y no mezclar inventario con Finanzas.

## Goals / Non-Goals

**Goals:**

- Fijar el esquema y la semántica que deberán compartir Sheets, Apps Script, panel y generadores de catálogo.
- Preservar pedidos históricos mediante snapshots y reglas explícitas de compatibilidad.
- Permitir que los saldos se reconstruyan y auditen sin depender de una cifra editable.
- Separar disponibilidad global, existencia física, modalidad de abastecimiento y cobro.
- Preservar sin reinterpretación los códigos externos/SKUs existentes antes de introducir una identidad de proveedor real.

**Non-Goals:**

- Crear Apps Script, endpoints, JSON, admin o catálogo en este change, o materializar campos privados cuya exclusión del workflow público todavía no esté implementada.
- Definir alertas o reposición automática, reservas en tiempo real, valuación contable o conciliación de cobros.
- Modelar `Proveedor_Efectivo` por movimiento: cada ingreso conserva su costo real, pero no registra un proveedor alternativo.
- Implementar en C-01 endpoints de Apps Script o CRUD administrativo de proveedores; esas responsabilidades pertenecen a C-02 y C-04 respectivamente.
- Cambiar la máquina de estados de pedidos, precios, promociones, envíos o la separación B2C/B2B.
- Completar registros históricos o modificar knowledge-base sin aprobación explícita.

## Decisions

### 1. Separar tres conceptos en lugar de derivarlos entre sí

`Modalidad_Abastecimiento` describe cómo se consigue el producto; `Gestiona_Stock` decide si una línea afecta saldo físico; `Sin_Stock` decide si puede iniciarse una nueva venta. Para nuevas líneas, `Gestiona_Stock` se deriva al crear el snapshot: sólo consignación y stock propio gestionan saldo.

**Rationale:** evita que saldo cero bloquee productos que pueden comprarse antes del viernes y evita reutilizar `Activo`, que controla publicación por canal. **Alternativa descartada:** inferir disponibilidad desde el saldo, porque convertiría el micro-stock en una promesa de inventario en tiempo real.

### 2. Preservar y renombrar los códigos legacy antes de reutilizar el nombre

Los campos actuales `Productos.Id_Proveedor` y `Precios.Id_proveedor` no representan proveedores: contienen códigos externos/SKUs de cada producto en el proveedor actual. La migración controlada deberá inventariar y preservar sus valores exactos, renombrar ambos conceptos a `Codigo_Proveedor` y verificar igualdad fila por fila antes de liberar el nombre `Productos.Id_Proveedor`. Ningún valor legacy podrá convertirse, mapearse ni validarse como identidad de proveedor habitual.

**Rationale:** el orden preserva datos y elimina la colisión semántica antes de introducir la FK nueva. **Alternativas descartadas:** reutilizar directamente los valores existentes o crear la FK antes del renombre, porque ambas opciones reinterpretan SKUs como proveedores.

### 3. Modelar proveedores como entidad operativa privada

`Proveedores` vivirá en la planilla operativa, no en el catálogo publicado. Su contrato será:

| Campo | Regla |
|---|---|
| `Id_Proveedor` | PK estable, no vacía y única; valores iniciales aprobados por el responsable |
| `Nombre` | Requerido para operación interna |
| `Telefono` | Opcional y privado |
| `Direccion` | Opcional y privada |
| `Activo` | Booleano requerido |
| `Notas` | Opcional y privada |

Después de preservar los códigos legacy, `Productos` permanecerá en la planilla de catálogo e incorporará allí un nuevo `Id_Proveedor` como FK privada a `Proveedores.Id_Proveedor`, cuya entidad vive exclusivamente en la planilla operativa privada. Un producto nuevo o reclasificado no será válido si la FK no existe o apunta a un proveedor inactivo. El admin resolverá el nombre mediante join por la clave; ni la FK ni los datos de `Proveedores` se publicarán en el JSON público. La materialización técnica de la FK y su exclusión del JSON corresponden a C-02. Los ejemplos, fixtures, pruebas y documentación no contendrán teléfonos, direcciones ni otros datos personales reales.

**Rationale:** una entidad privada permite integridad y mantenimiento sin mezclar identidad de proveedor con códigos de producto. **Alternativas descartadas:** nombre libre en Productos o publicar Proveedores junto con el catálogo.

### 4. Agregar identidad y snapshot por línea

Las líneas nuevas tendrán `Item_Id`, único dentro del pedido, más snapshots de `Id_Proveedor`, modalidad y `Gestiona_Stock`. Los snapshots se capturan desde la configuración vigente al guardar por primera vez y no se recalculan al leer.

**Rationale:** `Id_Pedido` e `Id_Producto` no expresan de forma segura la identidad de una línea ante ediciones o repeticiones. **Alternativa descartada:** consultar siempre el catálogo vigente, porque reinterpreta el histórico.

### 5. Derivar saldo desde un libro mayor append-only

El almacenamiento futuro será una colección `Movimientos_Stock` cuyos registros confirmados no se editan ni eliminan. Las cantidades llevan signo y el saldo resulta de su suma. Las rectificaciones se agregan como `CORRECCION` referenciada. `INGRESO` guarda el costo real de esa entrada sin alterar costos o precios del catálogo; no incorpora `Proveedor_Efectivo`, porque modelar proveedores alternativos por movimiento queda fuera de alcance.

**Rationale:** conserva auditoría y permite reconstruir saldos. **Alternativa descartada:** una celda de stock editable, que no explica consumos, mermas ni correcciones y no permite detectar duplicados.

Campos propuestos para la implementación posterior:

| Área | Campos contractuales |
|---|---|
| Códigos legacy preservados | `Productos.Codigo_Proveedor`, `Precios.Codigo_Proveedor` |
| Registro operativo privado | `Proveedores.Id_Proveedor`, `Nombre`, `Telefono?`, `Direccion?`, `Activo`, `Notas?` |
| Productos operativos privados | nuevo `Productos.Id_Proveedor` como FK, `Modalidad_Abastecimiento`, `Sin_Stock` |
| Snapshot de Items | `Item_Id`, `Id_Proveedor`, `Modalidad_Abastecimiento`, `Gestiona_Stock` |
| Movimiento | `Movimiento_Id`, `Fecha`, `Id_Producto`, `Tipo`, `Cantidad`, `Costo_Unitario`, `Referencia`, `Nota`, `Id_Pedido`, `Item_Id`, `Clave_Idempotencia` |

### 6. Aplicar ventas en la transición a Entregado

El procesamiento futuro comparará el estado persistido con el solicitado y sólo intentará aplicar ventas al entrar en `Entregado`. Cada `VENTA` automática escribirá `Clave_Idempotencia` con el valor exacto `VENTA:<Id_Pedido>:<Item_Id>`; ese campo será único entre los movimientos y se verificará dentro de la misma sección crítica antes de agregar el registro. Un reintento o re-guardado encuentra la misma clave y no produce efectos; una línea contra pedido no genera salida. La corrección posterior se expresa con movimientos adicionales; no se borra la venta.

**Rationale:** la entrega es el hito operativo acordado y la idempotencia protege reintentos. **Alternativas descartadas:** descontar al crear/confirmar el pedido, porque puede cancelarse o sustituirse, y descontar por `Medio_Pago`, porque inventario y cobro son registros distintos.

### 7. Compatibilidad histórica conservadora

La migración de códigos se ejecutará antes de crear la FK nueva y preservará todos los valores legacy como `Codigo_Proveedor`; no es un backfill ni una reclasificación de inventario. Los campos nuevos se añadirán sin reordenar columnas no involucradas y serán resueltos por encabezado. Desde esa implementación, todo producto nuevo o que se reclasifique deberá tener un nuevo `Id_Proveedor` válido y activo, `Modalidad_Abastecimiento` y `Sin_Stock`; un producto histórico aún no reclasificado mantiene la experiencia actual (`CONTRA_PEDIDO`, no gestionado, disponible), pero esos defaults son sólo de lectura. No habrá backfill de snapshots en `Items` ni creación retrospectiva de movimientos por pedidos históricos. Un ítem histórico sin snapshot nunca dispara una venta automática; cualquier regularización requiere movimientos explícitos.

**Rationale:** evita que datos incompletos generen salidas incorrectas. **Alternativa descartada:** inferir snapshots históricos desde el catálogo actual, porque ese catálogo puede haber cambiado.

## Validation Matrix

La implementación posterior deberá conservar esta matriz con ejemplos ficticios y sin datos personales:

| Caso | `Gestiona_Stock` del snapshot | ¿`Entregado` genera `VENTA`? | Saldo cero con `Sin_Stock = false` | `Sin_Stock = true` |
|---|---:|---:|---|---|
| `CONTRA_PEDIDO` | `false` | No | No bloquea la venta | Bloquea nuevas ventas globalmente |
| `CONSIGNACION` | `true` | Sí, una vez por ítem | No bloquea la venta | Bloquea nuevas ventas globalmente |
| `STOCK_PROPIO` | `true` | Sí, una vez por ítem | No bloquea la venta | Bloquea nuevas ventas globalmente |
| Ítem histórico sin snapshot | desconocido | No automático | No se infiere saldo | Conserva la señal manual del producto |

Casos transversales de validación: una primera transición a `Entregado` crea `Clave_Idempotencia = VENTA:<Id_Pedido>:<Item_Id>`; un reintento o re-guardado encuentra la misma clave única y no duplica ventas; `Cancelado` no genera ventas; una rectificación agrega `CORRECCION` sin editar el original; `Medio_Pago` nunca modifica inventario; sólo `Sin_Stock` puede salir al catálogo público.

## Risks / Trade-offs

- [La compatibilidad por defecto puede ocultar productos aún no clasificados] → Exponer una validación administrativa previa al rollout y bloquear la activación del flujo de stock hasta completar la matriz aprobada.
- [Renombrar un campo legacy sin verificar valores puede perder códigos externos] → Inventariar ambos campos, preservar valores exactos como `Codigo_Proveedor`, comparar antes/después y abortar ante cualquier diferencia.
- [Una FK reutiliza un nombre legacy y puede colisionar durante la migración] → No crear el nuevo `Productos.Id_Proveedor` hasta que ambos campos legacy estén preservados y el encabezado antiguo haya quedado liberado.
- [Una allowlist de proveedores sin identificadores estables fragmenta agrupaciones] → Usar sólo la lista inicial aprobada (`DISTROSEC`, `PROCAKE`, `HUEVOS`) y no inventar IDs ni registros.
- [Los datos opcionales de Proveedores pueden contener PII] → Mantener la entidad y sus joins privados, y usar sólo ejemplos sintéticos sin teléfonos ni direcciones reales.
- [El cambio de estado y la escritura del movimiento podrían quedar a mitad de camino] → El change de implementación deberá usar `LockService`, comprobar la unicidad de `Clave_Idempotencia` dentro de la misma sección crítica y reportar errores recuperables.
- [Las correcciones permiten saldos negativos] → No impedirlos silenciosamente; mostrarlos como señal de conciliación y exigir nota para toda corrección.
- [Un pedido entregado con ítems históricos no descuenta automáticamente] → Mantener esa omisión segura y ofrecer únicamente una regularización explícita y auditable.
- [La señal global `Sin_Stock` afecta B2C y B2B] → Confirmar expresamente este alcance antes de su publicación; no derivarla por canal ni por saldo.

## Migration Plan

1. Obtener la lista explícitamente aprobada de nuevos `Proveedores.Id_Proveedor`; no inferirla de los códigos legacy.
2. En C-01, inventariar los valores actuales de `Productos.Id_Proveedor` y `Precios.Id_proveedor`, preservarlos como `Codigo_Proveedor` y verificar que no cambió ningún valor.
3. Sólo después de liberar el nombre, crear en la planilla operativa la estructura privada `Proveedores` con las PK aprobadas. C-01 no crea una segunda hoja `Productos` ni materializa todavía `Productos.Id_Proveedor`, `Modalidad_Abastecimiento` o `Sin_Stock` mientras el workflow actual pudiera publicarlos.
4. En C-02, materializar la FK privada y los campos operativos de Productos, implementar mediante Apps Script la lectura/escritura privada de `Proveedores`, FK y libro mayor, y garantizar técnicamente su exclusión del catálogo público.
5. En C-03, implementar snapshots, identidad de línea y aplicación idempotente al entregar, conservando el histórico.
6. En C-04, implementar CRUD administrativo de `Proveedores` y joins por FK; en C-05, usar snapshots para listas por proveedor/modalidad.
7. En C-06, publicar sólo `Sin_Stock`; en C-07, ejecutar el piloto y proponer por separado cambios de knowledge-base.

Rollback: C-01 deberá conservar una copia verificable de encabezados y valores legacy y restaurar el nombre anterior si falla la comprobación antes de crear la FK nueva. Cada change posterior deberá poder desactivar su nueva lectura/escritura sin borrar columnas ni movimientos ya creados. Los movimientos confirmados nunca se revierten por eliminación; se compensan mediante corrección.

## Approval Gates

Antes de cualquier implementación operativa, el responsable deberá aprobar expresamente:

1. que `CONSIGNACION` y `STOCK_PROPIO` gestionan saldo y `CONTRA_PEDIDO` no;
2. que `Sin_Stock` bloquea nuevas ventas globalmente en B2C y B2B, sin modificar `Activo`;
3. que los actuales `Productos.Id_Proveedor` y `Precios.Id_proveedor` son códigos/SKUs de producto, se preservan como `Codigo_Proveedor` y nunca se reinterpretan como proveedor habitual;
4. la lista concreta inicial `DISTROSEC`, `PROCAKE` y `HUEVOS` como nuevas PK `Proveedores.Id_Proveedor`, junto con la entidad privada y la integridad que rechaza FK inexistente o proveedor inactivo;
5. la incorporación futura de `Item_Id` y los snapshots del nuevo `Id_Proveedor`, modalidad y `Gestiona_Stock` en `Items`;
6. el esquema append-only, los signos y `Clave_Idempotencia` única de `Movimientos_Stock`;
7. `Entregado` como único hito automático, la corrección explícita para excepciones y la política histórica sin backfill de `Items` ni movimientos.

## Apply Evidence — 2026-09-18

- Los siete Approval Gates fueron aprobados expresamente por el responsable.
- Planilla de catálogo `SISTEMA MENOS VUELTAS` (`[ID de planilla de catálogo verificado en preflight; no versionado]`): `⬛Productos!E1`, `⬛Precios!B1` y `⬛Precios!U1` se renombraron a `Codigo_Proveedor` sin reordenar columnas ni modificar otros valores.
- Inventario previo: Productos tenía 934 filas de datos, 468 códigos no vacíos y último valor en fila 469; cada rango de Precios tenía 470 fórmulas y 470 resultados no vacíos. Tras el cambio se conservaron exactamente esos conteos.
- Prueba de preservación: al normalizar únicamente el encabezado nuevo al nombre legacy, los hashes FNV-1a de valores efectivos y formateados coinciden antes/después (`Productos`: `a724e966`/`0c8ba330`; ambos rangos de Precios: `1fb7c38e`/`8c3ba462`). Las 940 fórmulas estructuradas de Precios se actualizaron automáticamente a `Productos[Codigo_Proveedor]`; no queda ninguna referencia a `Productos[Id_Proveedor]`. Dos errores de fórmula por rango ya existían y se preservaron exactamente, según los mismos hashes.
- Planilla operativa `MV - Pedidos` (`[ID de planilla operativa verificado en preflight; no versionado]`): se creó `Proveedores!A1:F4` con los encabezados contractuales y sólo las tres filas aprobadas. Las PK son no vacías y únicas; `Activo = SI`; `Telefono`, `Direccion` y `Notas` están vacíos. La fila de encabezado está congelada y en negrita.
- No se creó una segunda hoja Productos ni columnas físicas `Productos.Id_Proveedor`, `Modalidad_Abastecimiento` o `Sin_Stock`. Su materialización privada y la exclusión técnica del JSON/workflow quedan como handoff explícito a C-02; C-01 sólo fijó y validó el contrato de integridad.
- La inspección versionada confirmó que ninguna de las tres PK aprobadas ni los nombres Distrosec/Procake aparecen como datos de proveedor en el workflow, `shared/catalogo.json` o `admin/productos.json`. El `Id_Proveedor` presente hoy en `shared/catalogo.json` es la exportación legacy previa de códigos/SKUs, no la nueva FK; no se regeneró ni modificó JSON en C-01.
- No hay test runner versionado aplicable a esta tarea de datos. La verificación contractual, los snapshots/hashes antes y después, la relectura por API y la inspección visual de `Proveedores` sustituyen el ciclo TDD sin alterar código.
