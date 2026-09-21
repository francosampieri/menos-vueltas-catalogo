# CHANGES — Secuencia de Implementación

> Índice canónico de los changes para incorporar abastecimiento por múltiples proveedores, consignación y micro-stock en Menos Vueltas.
> Cada change es atómico: un agente puede implementarlo en una sesión (~4–6 horas).
> **Leer este archivo antes de ejecutar cualquier `/opsx:propose`.** Este plan no autoriza todavía cambios de código, Google Sheets ni knowledge-base: cada change debe proponer su cambio y esperar la aprobación requerida.

---

## Cómo usar este documento

1. Identificar el change pendiente más temprano cuyas dependencias estén completas.
2. Leer los documentos de knowledge-base indicados y verificar el estado real con `openspec status`.
3. Ejecutar `/opsx:propose` para ese change y explicitar el impacto antes de cambiar datos operativos, Apps Script o reglas de negocio.
4. Implementar y verificar el change con su propuesta aprobada; luego ejecutar `/opsx:archive` para sincronizar las especificaciones.
5. Marcar el checkbox de Estado sólo cuando la verificación manual indicada esté completa. Las actualizaciones de knowledge-base requieren confirmación explícita del responsable.

---

## Árbol de dependencias

```text
C-01 supply-and-inventory-data-contract
├── C-02 stock-movement-ledger-api
│   ├── C-03 delivered-order-stock-posting
│   │   └── C-05 supplier-fulfillment-worklists  (también requiere C-04)
│   └── C-04 inventory-admin-operations
│       ├── C-05 supplier-fulfillment-worklists  (también requiere C-03)
│       └── C-06 availability-and-out-of-stock-experience

C-07 operational-rollout-and-context-sync
└── C-04, C-05, C-06
```

### Paralelismo por fase

```text
GATE 0: planificación aprobada ✓
  → C-01 supply-and-inventory-data-contract              [Agente A]

GATE 1: C-01 ✓
  → C-02 stock-movement-ledger-api                        [Agente A]

GATE 2: C-02 ✓     ← FORK
  → C-03 delivered-order-stock-posting                    [Agente A]
  → C-04 inventory-admin-operations                       [Agente B]

GATE 3: C-03, C-04 ✓     ← FORK
  → C-05 supplier-fulfillment-worklists                   [Agente A]
  → C-06 availability-and-out-of-stock-experience         [Agente C]

GATE 4: C-04, C-05, C-06 ✓
  → C-07 operational-rollout-and-context-sync             [Agente A]
```

### Camino crítico (5 changes — ramas paralelas tras C-02)

`C-01 → C-02 → {C-03 || C-04} → C-05 → C-07`

`C-06` comienza sólo después de C-02 y C-04; puede ejecutarse en paralelo con C-05 después de que éste tenga sus dependencias C-03 y C-04 completas. C-07 espera C-04, C-05 y C-06.

### Plan óptimo con 3 agentes

| Paso | Agente A (Backend Core) | Agente B (Backend Aux) | Agente C (Frontend) |
|---|---|---|---|
| 1 | C-01 contrato de datos | — | — |
| 2 | C-02 libro de movimientos y API | — | — |
| 3 | C-03 descuento idempotente al entregar | C-04 operación manual de inventario | — |
| 4 | C-05 listas por proveedor/modalidad | apoyo de verificación cruzada | C-06 disponibilidad y agotado global |
| 5 | C-07 salida operativa y sincronización de contexto | — | — |

---

## FASE 1 — Contrato operativo y trazabilidad de inventario

> Primero se fijan las reglas y el registro auditable. No se usa el catálogo público ni una cifra editable como fuente única de stock.

### [C-01] `supply-and-inventory-data-contract`

- **Estado**: `[x]` completo — contrato y migración C-01 verificados; materialización privada de FK/campos operativos queda en C-02
- **Scope**:
  - Preservar los actuales `Productos.Id_Proveedor` y `Precios.Id_proveedor` como códigos externos/SKUs de producto mediante una migración controlada a `Codigo_Proveedor`; nunca reinterpretar esos valores como proveedor habitual y liberar el nombre antes de crear la nueva FK.
  - Definir la entidad privada `Proveedores` en la planilla operativa con `Id_Proveedor` PK estable, `Nombre`, `Telefono?`, `Direccion?`, `Activo` y `Notas?`; la lista inicial de IDs requiere aprobación explícita y no se inventan datos personales ni valores.
  - Mantener `Productos` en la planilla de catálogo y definir su nuevo `Id_Proveedor` como FK privada hacia `Proveedores.Id_Proveedor`, cuya entidad vive exclusivamente en la planilla operativa privada; definir además los valores controlados de `Modalidad_Abastecimiento` (`CONTRA_PEDIDO`, `CONSIGNACION`, `STOCK_PROPIO`) y `Sin_Stock`, sin reutilizar `Activo`; detectar FK inexistente o proveedor inactivo y excluir explícitamente la FK y los datos de proveedor del JSON público.
  - Definir la regla de disponibilidad: `Sin_Stock` es una decisión manual global que bloquea la venta; un saldo físico de cero no cambia por sí solo la disponibilidad pública, porque puede reponerse antes de la entrega del viernes.
  - Definir contrato de snapshots por ítem: proveedor habitual, modalidad y condición de gestión de stock se congelan al cargar un pedido, para evitar reinterpretar pedidos históricos.
  - Definir contrato de movimientos inmutables: ingreso, venta, consumo propio, rotura/merma y corrección; cantidad firmada, producto, costo, fecha, referencia y nota; `Proveedor_Efectivo` queda fuera de alcance.
  - Fijar `Entregado` como hito único de descuento automático, con `Clave_Idempotencia` única y exacta `VENTA:<Id_Pedido>:<Item_Id>`; definir excepciones y pedidos mixtos sin inferir cobro de `Medio_Pago`.
  - Limitar C-01 al contrato, migración y criterios de integridad; tests/validación con matriz de modalidades, preservación exacta de ambos campos legacy, PK/FK, privacidad y ejemplos sin datos reales.
- **Dependencias**: ninguna
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Catálogo, §Pedidos, §Ítems e §Integridad
  - `knowledge-base/05_reglas_de_negocio.md` §Fuente de verdad y datos, §Pedido, pago y entrega
  - `knowledge-base/07_flujos_principales.md` §Flujo B2C: compra y entrega y §Flujo de actualización de precios
  - `knowledge-base/08_arquitectura_propuesta.md` §Actualización del catálogo y §Panel administrativo
  - `knowledge-base/09_decisiones_y_supuestos.md` §Límites para agentes

### [C-02] `stock-movement-ledger-api`

- **Estado**: `[x]` completo — deployment existente en versión 16, rollback disponible a 15/14 y smoke productivo sólo lectura verificado (`listarProveedores = 3`, `resumenStock = 468`); sin escrituras sintéticas productivas
- **Scope**:
  - Crear la hoja operativa y el contrato `Movimientos_Stock` mediante Apps Script, sin reordenar ni alterar registros históricos de las hojas existentes.
  - Implementar mediante Apps Script la lectura/escritura privada de `Proveedores`, que vive exclusivamente en la planilla operativa privada; `Productos` continúa en la planilla de catálogo y su nueva FK `Id_Proveedor` se valida contra esa entidad sin copiarla al catálogo público.
  - Excluir del JSON público y del workflow de publicación la FK `Productos.Id_Proveedor` y todos los datos de `Proveedores`; sólo los flujos privados autorizados pueden leerlos o escribirlos.
  - Implementar endpoints autenticados por el flujo administrativo para listar resumen de saldo y registrar movimientos manuales; no exponer proveedor, costo ni movimientos al catálogo público.
  - Calcular saldo por SKU desde el libro mayor: ingresos y correcciones positivas menos venta, consumo propio, rotura/merma y correcciones negativas.
  - Aplicar `LockService`, identificadores de movimiento y validación de tipo, cantidad, producto y nota obligatoria para correcciones; registrar referencia de pedido cuando exista.
  - Tests: saldo con secuencias mixtas, productos sin stock gestionado, corrección negativa, límites automatizados de `LockService`, idempotencia y rechazo de payload inválido. Esta cobertura no afirma concurrencia productiva real; la prueba con escrituras se ejecutará en el piloto integrado C-07.
- **Dependencias**: `C-01`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Principio de autoridad e §Integridad
  - `knowledge-base/05_reglas_de_negocio.md` §Fuente de verdad y datos
  - `knowledge-base/07_flujos_principales.md` §Flujo B2C: compra y entrega
  - `knowledge-base/08_arquitectura_propuesta.md` §Arquitectura actual verificada y §Seguridad actual
  - `knowledge-base/10_preguntas_abiertas.md` §Finanzas y precios y §Producto y tecnología

### [C-03] `delivered-order-stock-posting`

- **Estado**: `[ ]` pendiente
- **Scope**:
  - Extender el snapshot de `Items` y el payload administrativo con los campos de abastecimiento aprobados, preservando el histórico de pedidos previos y asignando `Item_Id` una sola vez a cada línea nueva.
  - Al re-guardar un pedido pendiente, conservar por línea `Item_Id`, proveedor, modalidad y `Gestiona_Stock`; no identificar líneas por SKU, `Id_Producto`, cantidad ni posición, de modo que SKU repetido, cambio de cantidad y reordenamiento no alteren su snapshot.
  - Bajo el mismo `LockService` de C-02, detectar en Apps Script la transición a `Entregado`, aplicar ventas idempotentes sólo para líneas con stock gestionado y persistir `Entregado` únicamente si todas quedan aplicadas; tras fallo parcial, reintentar sólo las claves faltantes sin borrar ni reescribir ventas existentes.
  - Proteger la edición de ítems, cantidades o estado de un pedido ya entregado; una corrección posterior queda trazable mediante un movimiento nuevo y no modifica la venta histórica.
  - Tests focalizados: re-guardado tras reclasificar catálogo, SKU repetido, cambio de cantidad, reordenamiento, transición/idempotencia, pedido mixto, bloqueo posterior, fallo parcial multilínea con reintento y pedido histórico sin snapshot.
- **Dependencias**: `C-02` (C-01 queda cubierta transitivamente)
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Pedidos, §Ítems e §Integridad
  - `knowledge-base/05_reglas_de_negocio.md` §Pedido, pago y entrega
  - `knowledge-base/07_flujos_principales.md` §Flujo B2C: compra y entrega y §Flujo de cancelación
  - `knowledge-base/08_arquitectura_propuesta.md` §Panel administrativo
  - `knowledge-base/09_decisiones_y_supuestos.md` §Decisiones confirmadas

---

## FASE 2 — Operación diaria de abastecimiento

> La operación administrativa se construye sobre los movimientos auditables y separa proveedor habitual, modalidad y saldo físico.

### [C-04] `inventory-admin-operations`

- **Estado**: `[ ]` pendiente
- **Scope**:
  - Añadir al panel el CRUD privado de `Proveedores` y resolver el proveedor habitual mediante join `Productos.Id_Proveedor → Proveedores.Id_Proveedor`; rechazar referencias inexistentes o inactivas y no exponer teléfonos, direcciones o notas fuera del admin.
  - Añadir al panel una vista de inventario con saldo calculado, modalidad, proveedor habitual y `Sin_Stock`; conservar separación B2C/B2B donde corresponda, sin alertas ni listas automáticas de reposición.
  - Crear formularios de ingreso y de salida manual con tipos `Consumo propio`, `Rotura/Merma` y `Corrección`; la salida `Venta` sólo se crea automáticamente al entregar un pedido.
  - Permitir registrar el costo real en ingresos sin sobrescribir proveedor habitual ni el precio público del catálogo.
  - Mostrar historial de movimientos con referencia al pedido cuando corresponda; no mostrar datos personales del cliente en la vista de inventario.
  - Tests y verificación manual desktop/mobile: altas, salidas, correcciones, saldo resultante, error de API y reintento sin doble movimiento.
- **Dependencias**: `C-02`
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §Equipo interno
  - `knowledge-base/04_modelo_de_datos.md` §Integridad
  - `knowledge-base/05_reglas_de_negocio.md` §Fuente de verdad y datos
  - `knowledge-base/06_funcionalidades.md` §Administración — activa
  - `knowledge-base/08_arquitectura_propuesta.md` §Panel administrativo y §Seguridad actual

### [C-05] `supplier-fulfillment-worklists`

- **Estado**: `[ ]` pendiente
- **Scope**:
  - Reemplazar la única lista “a distribuidora” por listas agrupadas por proveedor habitual y modalidad, basadas en snapshots de los ítems de pedidos activos.
  - Excluir de compras contra pedido las líneas de consignación y stock propio; no crear alertas ni listas automáticas de reposición por saldo bajo o cero.
  - Mantener la lista agregada de Distrosec compatible y permitir copiar cada lista sin mezclar proveedores, canales ni productos con modalidad distinta.
  - Ajustar etiquetas/estados del panel si la nomenclatura aprobada deja de ser específica de Distrosec, sin cambiar la máquina de estados sin autorización.
  - Tests: pedidos con un proveedor, pedidos mixtos, dos proveedores menores, línea agotada y pedido cancelado/entregado excluido.
- **Dependencias**: `C-03, C-04`
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/02_descripcion_general.md` §Operación actual
  - `knowledge-base/04_modelo_de_datos.md` §Catálogo, §Pedidos e §Ítems
  - `knowledge-base/05_reglas_de_negocio.md` §Pedido, pago y entrega
  - `knowledge-base/07_flujos_principales.md` §Flujo B2C: compra y entrega
  - `knowledge-base/08_arquitectura_propuesta.md` §Panel administrativo

---

## FASE 3 — Disponibilidad visible y salida controlada

> La web sigue siendo un inicio de pedido por WhatsApp, no una reserva de stock ni un sistema de inventario en tiempo real.

### [C-06] `availability-and-out-of-stock-experience`

- **Estado**: `[ ]` pendiente
- **Scope**:
  - Propagar al catálogo reducido del panel y al catálogo público sólo el campo público `Sin_Stock`; no publicar costos, proveedores ni movimientos internos.
  - Aplicar `Sin_Stock` a búsqueda administrativa, tarjetas, detalle de producto, botones de agregar y carrito restaurado/QR; el saldo físico no altera este estado automáticamente.
  - Diseñar el estado visual de agotado y el mensaje de confirmación por WhatsApp para que no prometa reserva ni disponibilidad en tiempo real.
  - Mantener productos contra pedido bajo la experiencia actual y preservar los carritos/pedidos históricos cuando un producto pase a agotado.
  - Tests y revisión manual B2C/B2B, desktop/mobile: producto disponible, producto marcado sin stock, producto con saldo físico cero pero disponible, carrito preexistente, QR y catálogo con demora de publicación.
- **Dependencias**: `C-02, C-04`
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/01_vision_y_objetivos.md` §Propuesta de valor
  - `knowledge-base/04_modelo_de_datos.md` §Catálogo
  - `knowledge-base/05_reglas_de_negocio.md` §Pedido, pago y entrega
  - `knowledge-base/06_funcionalidades.md` §B2C — activo y §B2B — en preparación
  - `knowledge-base/08_arquitectura_propuesta.md` §Frontend público y §Actualización del catálogo

### [C-07] `operational-rollout-and-context-sync`

- **Estado**: `[ ]` pendiente
- **Scope**:
  - Ejecutar una prueba piloto sin datos personales: ingreso de consignación, ingreso de stock propio, venta entregada, consumo propio, merma, corrección y lista de abastecimiento por proveedor.
  - Ejecutar durante ese piloto la prueba de concurrencia real con escrituras e idempotencia que C-02 cubre sólo mediante tests automatizados; registrar el resultado sin usar datos personales ni confundirlo con una garantía general de concurrencia productiva.
  - Conciliar que un movimiento físico no se confunda con cobro/pago financiero y documentar el procedimiento operativo de revisión semanal.
  - Verificar manualmente el flujo completo en panel, B2C y B2B cuando corresponda, incluyendo desktop y mobile; registrar lo verificado y lo que sigue manual.
  - Proponer, sin editar automáticamente, las actualizaciones canónicas necesarias en `knowledge-base/02`, `04`, `05`, `07`, `08`, `09` y `10`; sólo aplicarlas tras confirmación explícita del responsable.
  - Definir criterios de salida: sin saldos negativos inexplicados, sin duplicados por re-guardar pedidos entregados, sin exposición pública de costos/proveedores y operación Distrosec preservada.
- **Dependencias**: `C-04, C-05, C-06`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/02_descripcion_general.md` §Operación actual y §Métricas y restricciones
  - `knowledge-base/04_modelo_de_datos.md` §Principio de autoridad e §Integridad
  - `knowledge-base/05_reglas_de_negocio.md` §Fuente de verdad y datos y §Pedido, pago y entrega
  - `knowledge-base/07_flujos_principales.md` §Flujo B2C: compra y entrega
  - `knowledge-base/09_decisiones_y_supuestos.md` §Límites para agentes

### Resumen de ejecución

| Change | Resultado verificable | Decisión ya fijada |
|---|---|---|
| C-01 | Contrato aprobado para migración de códigos legacy, entidad privada de proveedores, FK, modalidad, disponibilidad y movimientos | Los `Id_Proveedor` legacy son códigos/SKUs y se preservan como `Codigo_Proveedor`; `Activo` no se usa para faltante temporal. |
| C-02 | Saldo derivado de movimientos auditables y acceso privado a proveedores/FK | Entradas y salidas manuales incluyen consumo propio, merma y corrección; ventas provienen de pedidos entregados. |
| C-03 | Una venta aplicada descuenta una sola vez | El descuento depende del hito explícito `Entregado`, no de guardar el pedido. |
| C-04 | Panel permite gestionar proveedores, operar y auditar inventario | El back-office sigue siendo Sheets + Apps Script y los datos de proveedor permanecen privados. |
| C-05 | Listas separadas por proveedor/modalidad | Distrosec deja de ser el supuesto único de abastecimiento. |
| C-06 | Agotado global consistente, sin promesa de stock en tiempo real | WhatsApp continúa como instancia de confirmación. |
| C-07 | Piloto conciliado y contexto propuesto para confirmación | Finanzas conserva el registro de cobros reales. |

Primer change recomendado: `C-01` (`supply-and-inventory-data-contract`). Para arrancar: `/opsx:propose supply-and-inventory-data-contract`.
