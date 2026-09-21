## Context

Ver [proposal.md](proposal.md) para la motivación. El sistema actual es HTML/CSS/JavaScript vanilla, un único `apps-script/Code.gs` vinculado a la planilla operativa y un workflow que descarga CSV públicos del catálogo. `doPost` ya serializa todas las escrituras con `LockService`; las respuestas usan `{ ok, ... }`; las hojas operativas se crean y amplían por encabezado. `Productos` vive en otra planilla y `shared/catalogo.json` copia hoy las filas CSV casi completas, incluso campos que C-02 debe dejar de publicar. El admin sigue usando protección básica en navegador y la URL del Apps Script es conocida; esta propuesta acepta ese riesgo existente y no lo presenta como autenticación.

C-01 fijó el contrato y ya fue archivado. `Proveedores` existe en la planilla operativa con IDs iniciales aprobados. La FK, modalidad y `Sin_Stock` aún no existen en `Productos`. C-02 tiene gobernanza crítica por modificar estructuras de Sheets y datos operativos; este documento no autoriza apply ni cambios sobre planillas.

## Goals / Non-Goals

**Goals:**

- Agregar un libro mayor append-only y un resumen de saldo reproducible.
- Dar a C-04 una API administrativa mínima para proveedores, clasificación y movimientos manuales.
- Dar a C-03 un único escritor interno idempotente de ventas, sin conectarlo todavía a pedidos.
- Hacer explícita y verificable la frontera entre catálogo público y datos operativos.
- Mantener compatibilidad con hojas y acciones existentes mediante resolución por encabezado y ausencia de backfill.

**Non-Goals:**

- Rediseñar autenticación, permisos, deployment o arquitectura del Apps Script.
- Crear UI de inventario o proveedores; eso pertenece a C-04.
- Observar la transición a `Entregado` o modificar snapshots de `Items`; eso pertenece a C-03.
- Publicar `Sin_Stock` o cambiar la experiencia B2C/B2B; eso pertenece a C-06.
- Evitar saldos negativos, reservar unidades o automatizar reposición, pagos o liquidaciones.

## Decisions

### 1. Extender el Apps Script existente con acciones explícitas

Se mantienen `doGet` y `doPost` y su sobre JSON. Las acciones nuevas serán:

| Método | `accion` | Resultado |
|---|---|---|
| GET | `listarProveedores` | lista privada de `Proveedores` |
| GET | `resumenStock` | metadatos privados de abastecimiento y saldo por producto |
| POST | `crearProveedor` | alta con una nueva PK estable |
| POST | `actualizarProveedor` | actualización dirigida por `Id_Proveedor_Original`, sin mutar la PK |
| POST | `clasificarProducto` | escritura validada de FK, modalidad y `Sin_Stock` |
| POST | `registrarMovimiento` | alta manual no-`VENTA` |

`crearProveedor` recibe `Id_Proveedor` y los campos del proveedor. `actualizarProveedor` recibe `Id_Proveedor_Original` como identificador del registro objetivo y sólo los campos mutables; si además recibe `Id_Proveedor`, debe coincidir exactamente con el original o la solicitud se rechaza. Así una PK nueva se distingue de una actualización y nunca se interpreta silenciosamente como alta.

La venta usa la misma función interna de validación/escritura, no una acción manual. C-03 la invocará después de comprobar la transición efectiva a `Entregado`.

**Alternativa descartada:** crear otro backend o deployment. Añadiría infraestructura y una falsa expectativa de aislamiento que contradicen el alcance y el stack aprobados.

### 2. Acceder al catálogo por configuración de deployment, no por copia

El Apps Script obtendrá la planilla de catálogo con un ID guardado únicamente en la Script Property `CATALOG_SPREADSHEET_ID` y abrirá la pestaña cuyo título exacto es `⬛Productos`; las referencias conceptuales a `Productos` en esta propuesta y su spec nombran esa misma tabla. El valor de la propiedad no se versiona, no se imprime ni se incluye en artefactos públicos. La planilla operativa activa seguirá alojando `Proveedores` y `Movimientos_Stock`. Antes de escribir clasificación, se validará el proveedor contra la hoja operativa; no se copiarán nombre, teléfono, dirección o notas a `Productos`.

La inicialización comprobará primero el estado esperado tras C-01. Si no puede verificar `Codigo_Proveedor` y la ausencia de un conflicto semántico con la nueva FK, fallará de forma cerrada. Después agregará sólo encabezados faltantes al final, sin reordenar ni completar filas.

**Alternativas descartadas:** mover `Productos` a la planilla operativa, duplicar `Proveedores` en catálogo o usar el CSV público para escribir. Las tres rompen la autoridad y privacidad definidas en C-01.

### 3. Usar un ledger append-only con valores generados en servidor

`Movimientos_Stock` tendrá este orden canónico para libros nuevos:

```text
Movimiento_Id, Fecha, Id_Producto, Tipo, Cantidad, Costo_Unitario,
Referencia, Nota, Id_Pedido, Item_Id, Clave_Idempotencia
```

El servidor genera `Movimiento_Id` mediante UUID y `Fecha` con su reloj. La API no ofrece update ni delete. Las correcciones agregan otra fila y enlazan el antecedente en `Referencia`. El saldo se reduce a una suma por `Id_Producto`; no se mantiene una columna de saldo editable.

La inicialización del ledger pertenece exclusivamente a la primera escritura válida y se ejecuta dentro del mismo `LockService` que protege el append. `resumenStock` usa un lookup de hoja estrictamente de sólo lectura: si `Movimientos_Stock` aún no existe, responde con error sin crearla ni escribir o formatear encabezados. De este modo ningún GET cambia el estado de Sheets y dos primeras escrituras quedan serializadas sobre una única inicialización.

**Alternativa descartada:** guardar un saldo mutable en `Productos`. Es más simple de leer, pero permite divergencia y pierde la trazabilidad que exige C-01.

### 4. Centralizar validación e idempotencia antes de `appendRow`

Una única ruta interna normaliza el payload, carga la clasificación del producto, valida tipo/signo/costo/referencia y revisa `Clave_Idempotencia`. Para `CORRECCION`, `Referencia` debe resolver a un `Movimiento_Id` ya existente del mismo `Id_Producto`; una referencia ausente, inexistente, futura, propia o perteneciente a otro producto se rechaza. Sólo después agrega la fila. Para claves repetidas:

- payload idéntico: devuelve la fila existente como no-op exitoso;
- payload incompatible: rechaza la solicitud.

El lock de script cubre lectura de unicidad, generación de ID y append. `doPost` ya toma el lock; las funciones internas recibirán un contexto que evite intentar adquirirlo por segunda vez. Las escrituras iniciadas fuera de `doPost`, incluida la futura integración de C-03, usarán el mismo wrapper bloqueado.

**Alternativa descartada:** comprobar la clave antes de tomar el lock. Dos reintentos simultáneos podrían pasar el chequeo y duplicar la venta.

### 5. Separar movimiento manual de venta automática

`registrarMovimiento` rechaza `VENTA`. La función interna admite venta sólo con cantidad negativa, `Id_Pedido`, `Item_Id` y la clave calculada exactamente como `VENTA:<Id_Pedido>:<Item_Id>`. C-02 prueba ese escritor de forma aislada, pero no toca `guardarPedido`, estados ni `Items`.

Esto hace explícito el límite entre C-02 y C-03 y evita que una venta manual eluda el hito `Entregado`.

### 6. Derivar stock gestionado de la modalidad y no de `Sin_Stock`

`CONSIGNACION` y `STOCK_PROPIO` habilitan movimientos; `CONTRA_PEDIDO` y filas históricas vacías no. `Sin_Stock` se transporta en la respuesta privada, pero nunca se recalcula por saldo. Un saldo negativo permanece visible para conciliación y no dispara automatismos. `resumenStock` es lectura pura: exige que el ledger exista y valida todas sus filas; si falta la hoja o encuentra una fila malformada, falla de forma cerrada con un error explícito, sin mutar Sheets ni devolver balances parciales que puedan parecer autoritativos.

**Alternativa descartada:** impedir saldos negativos. Un bloqueo ocultaría desajustes operativos y convertiría C-02 en un sistema de reservas que no fue aprobado.

### 7. Sanitizar la publicación mediante listas blancas separadas

El workflow dejará de copiar filas crudas a `shared/catalogo.json`. Definirá listas explícitas de campos públicos para `Productos`, `Grupos` y cada tabla de `Precios`, excluyendo costos, claves/códigos de proveedor, FK, modalidad y cualquier campo desconocido. C-02 tampoco añadirá `Sin_Stock` a esa lista: C-06 decidirá su propagación y experiencia pública. Una aserción del workflow fallará si aparece cualquiera de los nombres privados prohibidos en el JSON generado.

`admin/productos.json` conservará el costo reducido que el panel ya usa para cálculos, bajo el nivel de protección actual, pero no recibirá contactos, notas, registros de proveedores ni movimientos. El Apps Script será la fuente para el futuro join administrativo.

**Alternativa descartada:** una lista negra de campos. Es más corta, pero filtraría tarde cualquier columna operativa nueva y repetiría el riesgo actual del volcado CSV completo.

### 8. Probar lógica pura con el runner nativo y verificar Sheets manualmente

No se agregan dependencias ni build. La lógica de validación, suma, privacidad e idempotencia se mantendrá en funciones deterministas cargables desde pruebas `node:test`, con stubs mínimos para servicios de Apps Script. Las pruebas de integración manual usarán sólo registros sintéticos en una copia o entorno controlado y verificarán encabezados, lock, append y respuestas. Strict TDD se aplicará durante apply: baseline, RED, GREEN, triangulación y refactor por tarea.

## Risks / Trade-offs

- **[El endpoint sigue siendo alcanzable conociendo la URL]** → Se limita el consumo a acciones del admin y se evita toda inclusión en B2C/B2B, pero se documenta que no existe autenticación fuerte. Corregirlo requiere un change separado.
- **[La consistencia entre dos planillas no es transaccional]** → La clasificación valida proveedor y payload antes de una única escritura en `Productos`; si falla una lectura, no escribe. No se realizan operaciones distribuidas de varias filas.
- **[Ediciones manuales pueden eludir Apps Script]** → El resumen valida tipos y reporta filas inválidas; el lock sólo protege escrituras del script. No se promete impedir edición directa de Sheets.
- **[Una lista blanca pública puede retirar campos que consumidores externos desconocidos usaban]** → Se captura el esquema actual, se prueba el código B2C/B2B contra el JSON sanitizado y se documenta la remoción de campos operativos como cambio intencional.
- **[Un libro mayor grande vuelve costosa la suma completa]** → Para el volumen actual se prioriza simplicidad. Se lee en lote y se agrega en memoria; no se añade cache ni saldo materializado hasta que exista evidencia de rendimiento insuficiente.
- **[Rollback después de movimientos reales]** → Nunca se borran filas del ledger. Se puede replegar la versión del script y deshabilitar las acciones nuevas, dejando datos auditables para reanudar o corregir explícitamente.
- **[Concurrencia real no ejercitada en producción durante C-02]** → C-02 conserva pruebas automatizadas de adquisición única del lock, primitivas ya bloqueadas e idempotencia, pero no las presenta como evidencia de concurrencia productiva. Las escrituras concurrentes reales se verifican en el piloto integrado C-07, cuando el flujo operativo completo esté disponible.

## Migration Plan

1. Ejecutar la suite existente y capturar el baseline antes de editar.
2. Implementar primero pruebas fallidas para sanitización, validación, saldo e idempotencia; luego el código mínimo y refactor con la suite verde.
3. Configurar el ID de la planilla de catálogo en Script Properties y ejecutar un preflight de sólo lectura: contrato de `Proveedores`, preservación legacy de C-01 y encabezados de `Productos`. Ante cualquier diferencia, detener sin escribir.
4. Desplegar el workflow sanitizado y verificar que B2C/B2B mantienen los campos consumidos y que `shared/catalogo.json` no contiene costos ni campos privados.
5. Con aprobación de apply y en ventana controlada, agregar los tres encabezados de `Productos` y crear `Movimientos_Stock`; no rellenar filas ni crear movimientos.
6. Crear una nueva versión de Apps Script y actualizar en el lugar el deployment existente para usarla, preservando la URL administrativa y sin crear otro deployment. C-02 quedó publicado como versión 16; las versiones 15 y 14 se conservaron como destinos de rollback.
7. Ejecutar únicamente smoke tests productivos de lectura. La evidencia de C-02 es `listarProveedores = 3` y `resumenStock = 468`; no se realizan altas, clasificaciones, movimientos ni otras escrituras sintéticas en producción.
8. Mantener la cobertura automatizada de límites de lock, idempotencia y desconexión de `Entregado`. Diferir la prueba de concurrencia real con escrituras al piloto integrado C-07; C-02 no afirma haberla ejecutado en producción.

**Rollback:** actualizar el mismo deployment desde la versión 16 hacia la versión 15 o 14, conservando su URL, y dejar encabezados y ledger ya creados sin uso; no borrar movimientos. El workflow MUST conservar la lista blanca explícita de privacidad o revertirse únicamente a una revisión conocida que ya sea privacy-safe; una vez que existan columnas privadas, nunca se restaura la publicación de filas crudas. C-02 no generó movimientos sintéticos productivos que deban neutralizarse.

## Confirmed Apply Constraints

- La Script Property se llama `CATALOG_SPREADSHEET_ID`; su valor se configura fuera del repositorio y debe verificarse mediante lectura posterior antes de cualquier escritura.
- La evidencia archivada de C-01 es prueba suficiente de preservación de `Codigo_Proveedor`; no se reconstruye el estado anterior desde la planilla actual.
- Antes de escribir se debe verificar que la hoja `Proveedores` existente usa exactamente los encabezados aprobados; una diferencia requiere detener el apply y volver a revisión, no migrarla silenciosamente.
- El deployment se actualiza en el lugar a una versión nueva; no se crea otro deployment ni se cambia la URL del frontend.
