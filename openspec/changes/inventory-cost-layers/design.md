# Design

## Context

`Movimientos_Stock` ya es el libro mayor privado, inmutable y append-only del saldo físico. Cada `INGRESO` contiene cantidad y costo unitario; las salidas se registran como cantidades negativas y las correcciones conservan una referencia. El resumen actual calcula sólo la suma algebraica, y `Productos.Modalidad_Abastecimiento` es mutable: por sí sola no puede clasificar históricamente el capital de un ingreso anterior.

La motivación y los límites funcionales están en [proposal.md](proposal.md) y en los deltas. La guía operativa solicitada (`docs/guia-operativa-proveedores-inventario.md`) no está presente en el repositorio al preparar esta propuesta; no se infirieron reglas desde datos reales ni se alteró ninguna fuente operativa.

## Goals / Non-Goals

**Goals:**

- Reconstruir, en cada lectura privada, tandas internas, asignaciones de costo y faltantes desde el ledger validado.
- Mantener FIFO estable aun si una fecha visible se modifica, mediante la posición append-only de la fila.
- Separar en la lectura los valores de `STOCK_PROPIO` y `CONSIGNACION` sin reinterpretar ingresos históricos ante cambios de producto.
- Mantener un detalle explicable que conecte cada salida con su costo o con su faltante pendiente.

**Non-Goals:**

- No introducir una hoja de tandas, un cache autoritativo, backfill, recálculo que escriba resultados, ni alterar los movimientos existentes.
- No representar lotes reales, vencimientos, proveedor efectivo, reservas, reposición, disponibilidad pública, precios de venta, B2C/B2B, Finanzas, pagos o liquidaciones de consignación.
- No cambiar los montos de saldos físicos: la valorización los lee y explica; no los corrige.

## Decisions

### 1. Proyección de lectura, no fuente duplicada

La fuente única será `Movimientos_Stock`. La consulta recorre sus filas válidas en orden físico de inserción (excluido encabezado) y construye en memoria, por `Id_Producto`, tres colecciones efímeras:

- cola FIFO de tandas abiertas;
- cola FIFO de salidas pendientes de costo;
- mapa de asignaciones reconstruidas para trazabilidad y para correcciones.

No se persistirán tandas, asignaciones ni faltantes. Esto permite reproducir cualquier resultado desde el ledger y evita divergencia entre una tabla derivada y el libro mayor.

Alternativa descartada: una hoja `Tandas_Stock` con saldos mutables. Haría más rápida la lectura, pero sería una segunda verdad, requeriría recuperación ante fallas y abriría el riesgo de que ya no coincida con el ledger.

### 2. Contrato inmutable de modalidad y tramos no valorizables

Al implementar, `Movimientos_Stock` incorporará la columna privada `Modalidad_Abastecimiento`, resuelta por encabezado y sin reordenar columnas. En todo `INGRESO` nuevo será obligatoria y admitirá exactamente `STOCK_PROPIO` o `CONSIGNACION`; la escritura debe rechazar antes de append cualquier ausencia, valor distinto o costo unitario inválido. Es un atributo histórico del evento fuente, no una tanda adicional ni un proveedor efectivo.

Un `INGRESO` histórico puede tener esa columna vacía por compatibilidad. Si modalidad y costo están ambos vacíos, origina un tramo explícitamente **no valorizable**: conserva cantidad, orden e identidad de tanda y saldo físico, pero no entra en ningún valor a costo. Si la modalidad está vacía y el costo es numérico, finito y no negativo, origina `LEGADO_VALORIZABLE_SIN_MODALIDAD`: conserva ese costo, participa FIFO y suma al valor físico conocido, pero no se atribuye a capital propio ni a consignación; la UI debe advertir que la composición por modalidad histórica es incompleta. No se deriva ni se completa esa modalidad desde el producto actual. Un ingreso con datos malformados fuera de estos dos casos (por ejemplo, modalidad no vacía fuera del enum, costo no numérico o negativo, cantidad inválida o campos requeridos ausentes en un ingreso nuevo) falla cerradamente para la valorización, sin total parcial engañoso.

Un saldo previo sin ingreso histórico queda sin tanda y sin valor hasta que el responsable registre un `INGRESO` inicial real. Un cambio posterior a `Productos.Modalidad_Abastecimiento` no cambia la modalidad de ingresos ya asentados: aun si el producto hoy es `CONTRA_PEDIDO`, sus tandas abiertas históricas siguen visibles y valorizadas por su snapshot; esa modalidad actual es sólo informativa.

Alternativa descartada: leer la modalidad actual del producto para todas las tandas. Revalorizaría silenciosamente capital propio como consignación, o a la inversa, y rompería el histórico.

### 3. Algoritmo FIFO por orden de ledger

Para cada fila, la proyección aplica estas reglas:

| Movimiento | Tratamiento de costo derivado |
|---|---|
| `INGRESO +q` | Siempre crea primero la identidad de tanda `INGRESO:<Movimiento_Id>` con su cantidad original, costo y modalidad. Para legado con modalidad vacía y costo válido usa el estado `LEGADO_VALORIZABLE_SIN_MODALIDAD`; para modalidad y costo vacíos usa tramo no valorizable. Su cantidad cubre faltantes pendientes del producto desde el más antiguo; sólo el excedente queda como remanente abierto. Si no hay excedente, la tanda sigue en el historial con remanente cero. |
| `VENTA -q` | Consume automáticamente tandas abiertas FIFO; el saldo sin tanda pasa a faltante pendiente. |
| `CONSUMO_PROPIO -q` | Igual que `VENTA`, sin efecto en pedidos ni Finanzas. |
| `ROTURA_MERMA -q` | Igual que `VENTA`, sin efecto en precios, disponibilidad o liquidaciones. |
| `CORRECCION -q` | Igual que otra salida: FIFO automático y faltante si supera las tandas. Conserva referencia del antecedente. |
| `CORRECCION +q` | Sólo revierte una salida negativa referida del mismo producto, hasta su cantidad neta aún no revertida. Primero cancela el tramo pendiente de esa salida y, después, restaura automáticamente sus capas FIFO valorizadas; no crea una tanda ni costo inventados. |

Una asignación registra conceptualmente `{salidaMovimientoId, tandaIngresoId, cantidad, costoUnitario}`. No es una fila persistida. Cuando una salida cruza tandas, se generan varias asignaciones. Cuando no hay tandas suficientes, se conserva un registro efímero `{salidaMovimientoId, cantidadPendiente, ordenLedger}` sin costo hasta su cobertura posterior.

Para mantener la corrección positiva determinista, `Referencia_Movimiento_Id` es obligatoria y debe identificar una `VENTA`, `CONSUMO_PROPIO`, `ROTURA_MERMA` o `CORRECCION` negativa anterior, del mismo `Id_Producto`. Su máximo es `abs(cantidad de la salida referida) − Σ(correcciones positivas válidas que la refieren)`. Esto permite reversiones parciales y varias reversiones válidas hasta agotar exactamente esa cantidad; una segunda reversión que excede el saldo neto no revertido se rechaza antes de escribir (doble reversión).

La cantidad de una corrección positiva se aplica, para la salida referida, en este orden: (1) reduce o elimina primero su faltante pendiente aún abierto, sin restaurar una capa; (2) si ese faltante ya fue cubierto por un ingreso posterior, deshace primero esa cobertura, restaura el remanente de la tanda de aquel ingreso y marca ese tramo de la salida como revertido; (3) restaura las asignaciones FIFO que ya estaban valorizadas, respetando su trazabilidad y costo histórico. Las cantidades restauradas reabren su tanda de origen y se ordenan por el orden append-only original de esa tanda para las salidas futuras; no se crea una tanda nueva ni se permite selección manual. Si una reversión parcial termina en cualquier paso, los pasos posteriores no se ejecutan. La referencia es inválida y se rechaza si falta, apunta a un movimiento positivo/no-salida, a otro producto, a una salida posterior, supera el neto reversible, o no puede reconstruirse de forma íntegra desde un ledger válido. Una corrección negativa nunca elige tanda: consume FIFO como toda salida.

Alternativa descartada: pedir un costo manual para correcciones positivas o permitir elegir una tanda. Ambos crean una decisión de valuación fuera del ledger y contradicen la ausencia de selección manual de tanda.

### 4. Resolución de faltantes pendientes

Un faltante no es una tanda negativa ni modifica el saldo algebraico. Es el tramo de una salida que no obtuvo costo porque las tandas existentes ya estaban agotadas. Se conserva en cola por producto y orden del ledger.

El próximo `INGRESO` del mismo producto lo cubre antes de abrir su remanente. La cantidad cubierta recibe el costo real de ese ingreso y queda enlazada a la salida previa en la proyección; la tanda de ese ingreso existe igualmente, aunque su remanente sea cero. Así la historia de la salida se completa sin cambiar la fila original. Si el ingreso no alcanza, el resto sigue pendiente; si alcanza y sobra, el sobrante es la única parte que queda como tanda abierta.

Esto evita atribuir artificialmente costo cero a una salida y evita que un ingreso posterior salte un faltante anterior.

### 5. Contrato de vistas privadas

La tabla principal de Inventario mostrará para cada producto gestionado: producto, modalidad actual informativa, saldo físico existente, capital en stock propio, valor en consignación, valor físico total a costo y un indicador/cantidad de faltante pendiente de costo. Si hay un tramo no valorizable, mostrará los valores conocidos separados y “capital total incompleto”. Si hay `LEGADO_VALORIZABLE_SIN_MODALIDAD`, el total físico incluye su costo pero la tabla advierte “composición por modalidad histórica incompleta”, sin atribuirlo a propio ni consignación. Los productos que tengan tandas abiertas continúan visibles con esos valores aunque su modalidad actual sea `CONTRA_PEDIDO`. Sólo lista tandas abiertas en su desglose; una tanda agotada no ocupa la vista principal.

El modal de producto mostrará una cronología de sólo lectura: ingresos de origen, tandas abiertas y agotadas, cantidad original/remanente, costo histórico, asignaciones de ventas/consumo/merma/correcciones, relación de correcciones y faltantes (pendientes o posteriormente cubiertos). No mostrará ni resolverá datos de clientes, cobros o Finanzas, ni tendrá controles para seleccionar, crear, borrar, fusionar o reordenar tandas.

Los valores conocidos se calculan con las tandas abiertas valorizables: `capital propio = Σ(remanente × costo)` de `STOCK_PROPIO`; `consignación = Σ(remanente × costo)` de `CONSIGNACION`; `legado sin modalidad = Σ(remanente × costo)` de `LEGADO_VALORIZABLE_SIN_MODALIDAD`; `total físico conocido = capital propio + consignación + legado sin modalidad`. Un faltante pendiente o tramo no valorizable no suma valor ni se disfraza como costo cero.

### 6. Compatibilidad y condiciones de fallo

El lector mantiene el saldo actual como suma algebraica de todas las cantidades. Las salidas históricas, los históricos sin snapshot y todo movimiento válido continúan legibles; no se escribe un backfill ni se crean salidas retrospectivas. Las excepciones históricas son explícitas: modalidad y costo vacíos es tramo no valorizable, y modalidad vacía con costo válido es `LEGADO_VALORIZABLE_SIN_MODALIDAD`, valorizable sin clasificación de composición. La segunda conserva su costo y no puede inferir modalidad desde `Productos`; la primera impide presentar capital total completo. Cualquier otro incumplimiento del contrato se rechaza cerradamente para la valorización, sin devolver totales parciales como si fueran completos.

El usuario puede regularizar ese caso sólo mediante un ingreso inicial real, nuevo, documentado y con costo real. No se cambia la fecha, la modalidad, el saldo ni el contenido de movimientos anteriores.

## Risks / Trade-offs

- [El ledger no conserva hoy una modalidad de ingreso inmutable] → añadir la columna privada sólo para ingresos futuros; conservar el costo histórico válido sin modalidad como `LEGADO_VALORIZABLE_SIN_MODALIDAD`, advertir su composición incompleta y no usar la modalidad actual para reescribir la historia.
- [Una corrección positiva puede exceder, duplicar o referir una salida incorrecta] → validar referencia, producto, tipo, orden y cantidad neta reversible antes de escribir, en vez de solicitar costo o tanda manual.
- [Un valor conocido puede confundirse con capital total] → mostrar estado de tramo no valorizable y nunca rotular la suma conocida como completa.
- [La lectura completa puede ser más costosa a medida que crece el ledger] → mantenerla pura y validar el volumen real antes de considerar una optimización; cualquier cache futuro debe ser descartable y nunca autoritativo.
- [Un faltante posterior a una salida hace que el costo de esa salida aparezca sólo tras un ingreso] → mostrar el estado pendiente explícitamente, con su cantidad y la cobertura posterior, en lugar de registrar costo cero.
- [Cambio de clasificación de producto] → snapshot de modalidad en el `INGRESO`; los valores actuales y el historial no se mezclan.

## Migration Plan

1. Añadir la columna privada `Modalidad_Abastecimiento` al contrato de `Movimientos_Stock`, validándola por nombre como obligatoria y enum estricto sólo para los `INGRESO` nuevos, sin reordenar ni completar filas existentes.
2. Implementar un lector puro que primero reconstruya y valide tandas, asignaciones, faltantes y totales antes de responder.
3. Conectar el resumen y el modal privados de Inventario a esa respuesta, manteniendo los saldos existentes y ocultando tandas agotadas sólo en la tabla principal.
4. Verificar con pruebas focalizadas y manualmente mediante escenarios aislados del flujo privado; no crear planillas temporales, no usar datos sintéticos en producción y no realizar despliegues como parte de este change.
5. Si aparece un error de lectura, revertir la presentación de valorización sin tocar el ledger: al no haber proyección persistida, el rollback no requiere migración ni restauración de datos.
