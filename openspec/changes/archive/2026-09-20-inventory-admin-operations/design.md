## Context

Ver `proposal.md` para la motivación y `specs/inventory-admin-operations/spec.md` para el contrato observable. C-01 dejó definido que proveedor habitual, modalidad y `Sin_Stock` son metadatos privados de `Productos`; C-02 materializó las acciones privadas `listarProveedores`, `crearProveedor`, `actualizarProveedor`, `clasificarProducto`, `resumenStock` y `registrarMovimiento`. El libro mayor es inmutable, `resumenStock` deriva el saldo y falla de forma cerrada si no existe o es inválido. C-03 está planificado y parcialmente implementado, pero la única fuente futura de `VENTA` sigue siendo su transición a `Entregado`; C-04 no la espera ni la reemplaza.

El panel actual es HTML/CSS/JavaScript vanilla que consume `admin/productos.json` para la referencia pública de productos y Apps Script para la operación privada. Ese JSON no puede enriquecerse con clasificación, proveedor, costos o movimientos. Apps Script ya preserva el sobre `{ ok: true, ... }` / `{ ok: false, error: ... }`, los encabezados por nombre y `LockService`; no se agrega backend, dependencia, build ni modificación de los sitios públicos.

## Goals / Non-Goals

**Goals:**

- Integrar una operación de inventario privada, pequeña y recuperable en el panel existente, reutilizando los contratos de C-02.
- Convertir cada intención manual de movimiento en un único payload idempotente y mantener la evidencia del ledger como fuente de verdad.
- Añadir el mínimo endpoint de lectura necesario para ver el historial sin cargar ni exponer datos de pedidos o clientes.
- Mantener pruebas focalizadas y una revisión manual útil, sin entornos temporales ni escrituras sintéticas productivas.

**Non-Goals:**

- No cambiar el contrato comercial ni público de B2C/B2B, ni publicar `Sin_Stock`; esa propagación queda para C-06.
- No rediseñar autenticación, despliegue, catálogo, estructura de Sheets, Apps Script existente fuera de la acción de lectura nueva, ni migrar datos.
- No crear paneles analíticos, paginación, alertas, reglas de reposición, reservas, liquidaciones ni conciliación financiera.

## Decisions

### 1. Panel por módulos privados sobre las acciones ya entregadas

La UI se organizará en cuatro módulos operativos dentro de `admin/`: proveedores, clasificación, inventario/movimientos y historial. Las listas de proveedor y resumen se cargarán desde Apps Script; `admin/productos.json` se usará sólo para etiquetar y buscar productos, nunca como fuente de proveedor, modalidad, saldo, costo ni `Sin_Stock`. Después de cada mutación confirmada, se volverá a consultar únicamente el módulo afectado y el resumen cuando pueda cambiar el saldo.

La baja del CRUD se implementará como desactivación confirmada (`Activo = false`), porque C-01/C-02 prohíben el borrado físico y la mutación de la PK. Desactivar no inventa una reclasificación ni modifica automáticamente productos, pedidos, ítems o movimientos ya existentes. Una clasificación nueva o modificada seguirá rechazando un proveedor inactivo; la vista puede identificarlo como inactivo sin exponerlo fuera del admin.

Alternativa descartada: editar proveedor, modalidad, saldo o movimientos dentro de `admin/productos.json` o una cifra editable en `Productos`. Duplicaría datos privados, permitiría divergencias y rompería el libro mayor como fuente de verdad.

### 2. Un formulario de movimiento construye el payload canónico y conserva su clave de reintento

El formulario pide una magnitud legible para la persona operadora; al enviar, serializa el signo que exige el ledger: positivo para ingreso, negativo para consumo propio y merma, y el signo elegido para corrección. `INGRESO` exige costo unitario no negativo; una corrección exige nota y selección de un antecedente del mismo producto. El formulario no presenta ni puede construir `VENTA`, `Id_Pedido` o `Item_Id`.

Al iniciar el primer envío, el navegador generará una clave `MANUAL:<UUID>` y conservará una copia inmutable del payload hasta recibir una respuesta concluyente. Un reintento reutiliza ambos valores; una nueva acción explícita crea otra clave. C-02 ya compara la totalidad del contenido ante una clave repetida dentro de `LockService`, por lo que el servidor devuelve el movimiento previo si fue el mismo intento o rechaza una colisión incompatible. La UI deshabilita el reenvío mientras haya una solicitud en curso, pero esa medida es sólo de experiencia: la protección real es la clave del ledger.

Alternativa descartada: confiar sólo en deshabilitar el botón o generar una clave distinta tras cada error. Ambos casos pueden duplicar un movimiento cuando la escritura alcanzó Apps Script pero la respuesta no llegó al navegador.

### 3. Nuevo GET privado y puro para el historial mínimo

C-02 no expuso una lectura de movimientos individuales; `resumenStock` no sirve como historial porque sólo devuelve saldos agregados. C-04 agregará a `doGet` la acción privada `listarMovimientos`, conservando el sobre JSON existente. Ésta localizará la hoja sin crearla, validará encabezados y filas con las mismas reglas del ledger, ordenará todos los movimientos válidos de más reciente a más antiguo y aplicará sólo filtros opcionales por `Id_Producto` y `Tipo`.

Para el volumen actual devolverá el historial completo y no añadirá paginación, cache ni agregados. El servidor devolverá únicamente campos del ledger; el navegador podrá asociar un nombre de producto desde el catálogo reducido ya permitido, pero no consultará `Pedidos`, `Clientes`, `Contactos` ni Finanzas. Si falta o es inválido el ledger, responde `ok: false` y no entrega una lista parcial.

Alternativa descartada: resolver `Id_Pedido` contra el detalle de pedidos para volverlo “más útil”. Eso incorporaría nombre, teléfono, dirección, canal, precios o cobros al flujo de inventario y violaría la separación y privacidad requeridas.

### 4. Separar saldo físico, disponibilidad manual y canales

La tabla de inventario representa el saldo por `Id_Producto`, no una reserva ni una promesa de disponibilidad. Muestra explícitamente `Saldo`, `Gestiona_Stock`, modalidad, proveedor habitual y `Sin_Stock`. Para `CONTRA_PEDIDO` o productos históricos no clasificados, conserva `Saldo = null`/no aplicable; no rellena cero. Para consignación o stock propio, cero o negativo se muestra tal cual y nunca modifica `Sin_Stock`.

`Sin_Stock` se edita como dato manual global de producto y no como cálculo de la vista. C-04 no toca el JSON público ni B2C/B2B, por lo que su cambio será privado hasta C-06. Si el panel ofrece un contexto de canal, mantiene los productos, precios, pedidos, clientes y métricas de ese canal sin combinarlos; el saldo del producto no habilita una agregación intercanal.

Alternativa descartada: transformar saldo cero en `Sin_Stock` o restar manualmente una “venta”. La primera mezcla dos decisiones distintas; la segunda elude el hito `Entregado`, la idempotencia y la trazabilidad de C-03.

### 5. Privacidad y superficie de exposición explícitas

Proveedores, costos, clasificación y movimientos sólo se solicitan desde `admin/`; no se añaden a workflows de catálogo, `shared/catalogo.json`, `admin/productos.json`, B2C ni B2B. El módulo de proveedores contiene teléfono, dirección y notas sólo cuando el responsable autorice mostrarlos en el admin actual; no se reutilizan en el historial. El historial no devuelve ni resuelve PII de clientes: una venta puede mostrar únicamente `Id_Pedido` e `Item_Id`, sin tratarla como cobro.

Alternativa descartada: almacenar datos operativos en el JSON del panel para reducir solicitudes. Aunque simplifica la pantalla estática, los convertiría en artefactos versionados/publicables y elevaría su exposición.

### 6. Validación focalizada sin datos operativos sintéticos

Durante apply se usará el patrón de pruebas nativo existente, con baseline antes de cada archivo afectado y ciclo RED → GREEN → triangulación → refactor. Se agregarán pruebas puras o con stubs mínimos de Apps Script para: lectura estricta/ordenada y privada de historial; conversión de formularios a payloads firmados; claves manuales persistidas para reintento; rechazo de `VENTA`; y refresco/error de UI. La revisión manual revisará la interfaz en escritorio y móvil, sus estados de carga/error y que la UI no muestre PII de clientes ni prometa disponibilidad.

No se crearán entornos temporales, fixtures de producción, proveedores/ítems ficticios en Sheets ni escrituras sintéticas en el deployment. Las verificaciones de escrituras reales, concurrencia productiva y piloto integral se mantienen para C-07 con la autorización correspondiente.

## Risks / Trade-offs

- **[El admin actual no tiene autenticación fuerte y los proveedores pueden tener datos de contacto]** → Antes de apply se requiere autorización explícita para renderizar esos campos privados; se limitan al módulo de proveedores y se excluyen de toda otra respuesta/interfaz.
- **[Un ledger ausente o manipulado manualmente no permite un historial confiable]** → `listarMovimientos` y la vista fallan de forma cerrada, no inicializan la hoja ni muestran datos parciales; la corrección es operativa y auditada, no automática.
- **[El historial completo puede crecer con el volumen]** → Se lee en lote por simplicidad, igual que el resumen de C-02. Si existe evidencia de rendimiento insuficiente, un change posterior podrá proponer paginación; C-04 no la anticipa.
- **[Una operación manual puede ser doblemente enviada por red]** → La misma clave `MANUAL:` y el payload congelado se reintentan contra la idempotencia del servidor; una nueva intención usa otra clave.
- **[Desactivar un proveedor aún visible en clasificaciones previas puede confundir]** → La UI conserva la referencia para trazabilidad y marca el estado inactivo; no borra ni reclasifica datos sin intervención explícita.
- **[Una venta física puede interpretarse como ingreso financiero]** → El historial expone sólo la referencia operativa y no carga ni modifica Finanzas, `Medio_Pago` ni datos de cliente.

## Migration Plan

1. Antes de apply, obtener la autorización de alcance MEDIO, la decisión de mostrar campos de contacto de proveedores en el admin actual y los datos reales aprobados para cualquier alta o clasificación. No se modifica knowledge-base en este change.
2. Capturar el baseline de las pruebas focalizadas existentes; escribir primero las pruebas que describan `listarMovimientos`, el payload/manual idempotente y los estados visibles de admin.
3. Implementar el GET puro de historial en Apps Script y después los módulos del panel, sin tocar workflow, JSON de catálogo ni superficies B2C/B2B.
4. Ejecutar las pruebas focalizadas y el conjunto existente; revisar manualmente desktop y mobile con datos ya autorizados, sin generar fixtures ni escrituras sintéticas productivas.
5. Publicar o actualizar Apps Script sólo si existe autorización específica para apply. Si es necesario rollback, retirar los módulos/UI y volver al deployment previo sin borrar proveedores, clasificaciones ni filas del ledger; toda rectificación física se agrega como nuevo movimiento trazable.

## Approval Required Before Apply

- Autorizar explícitamente implementar C-04 (gobernanza MEDIA) sobre `admin/` y la acción privada de lectura de Apps Script.
- Confirmar que el módulo de proveedores puede mostrar teléfono, dirección y notas dentro del admin actual de seguridad básica, o indicar que esos campos deben omitirse de la interfaz aunque sigan en el contrato privado.
- Aportar o aprobar los identificadores, nombres y estados reales de proveedores, y cada clasificación o `Sin_Stock` real. No se inventarán valores ni habrá backfill.
