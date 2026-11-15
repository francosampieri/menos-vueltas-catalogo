# Spec de implementación — Meta Pixel mínimo para B2C

Fecha: 5 de noviembre de 2026.

Documento de traspaso a otra sesión. Define la implementación local solicitada al usar el prompt final; no autoriza despliegue, gasto publicitario ni cambios de permisos de cuentas. En esta sesión sólo se redactó la spec.

## 1. Objetivo y contexto

Menos Vueltas prepara una primera prueba de Meta Ads con techo de ARS 60.000 de desembolso total: ARS 20.000 de presentación con destino web y ARS 40.000 de captación a WhatsApp. El retargeting sigue en evaluación según el público disponible; instalar el Pixel no obliga a activarlo.

La compra real sigue este recorrido:
22222222222222222222222222
`Web B2C → carrito → intento de abrir WhatsApp → conversación → confirmación → entrega/cobro`.

El Pixel debe medir sólo las acciones observables en la web y permitir evaluar públicos de visitantes. Debe registrar la actividad elegible de B2C con independencia de si la visita llega desde anuncios, WhatsApp, Google, acceso directo u otro origen. No condicionar el funcionamiento a `fbclid`, UTMs o referer. Registrar un evento no garantiza que Meta lo atribuya a un anuncio ni que identifique a todos los visitantes.

Prioridad: implementación pequeña, reversible y comprensible. No ampliar a una plataforma de analítica o CRM.

### Conversión comercial principal

El responsable indica que aproximadamente el 99% de quienes llegan al envío del pedido a WhatsApp terminan comprando. Es una observación operativa del responsable; esta spec no deriva de ella una tasa medida por el Pixel ni garantiza el mismo resultado en público nuevo.

Usar `WhatsAppOrderClick` como **conversión comercial principal de la web** y como indicador de pedidos/ventas estimadas para evaluar captación. No relegarlo a una métrica secundaria por no ser un cobro. Nombre visible propuesto: «Pedido iniciado por WhatsApp». Mantener `PageView` y `AddToCart` como pasos previos de diagnóstico.

El evento conserva su nombre y significado observables. Preparar instrucciones para crear una conversión personalizada basada en él y mostrar su conteo/costo en Ads Manager; verificar permisos, recepción, atribución y elegibilidad antes de afirmar que puede usarse para optimizar una campaña concreta. Una campaña directa a WhatsApp no empieza a optimizar automáticamente por ese evento web.

Para interpretar el conteo como pedidos, atender a los reintentos: dos reaperturas del mismo carrito pueden corresponder a una compra. Distinguir duplicación técnica de reintento deliberado y documentar el alcance real; no presentar clics brutos como pedidos únicos. No construir identidad de clientes, atribución entre dispositivos ni un sistema nuevo de pedidos para resolverlo. Mantener comparación manual simple con pedidos recibidos/cobrados para calibrar el indicador.

No enviar importes de carrito como ingresos confirmados ni calcular ROAS de cobros a partir de ese evento. La elección del KPI no cambia la fuente de verdad de ventas cobradas.

## 2. Leer antes de trabajar

- `AGENTS.md` vigente y las instrucciones adicionales de la sesión.
- `knowledge-base/README.md` y documentos `04`, `05`, `07`, `08` y `09` para datos, flujo, arquitectura y autonomía.
- `docs/continuidad-marketing-b2c.md`, especialmente presupuesto, retargeting y evaluación del Pixel.
- Código actual de `b2c/index.html`, `shared/app.js` y patrones reales de `tests/`.

Revisar el estado Git y preservar cambios existentes. No reabrir diseños de eventos o heros. No modificar KB, AGENTS/CLAUDE, Sheets, Apps Script, catálogos generados, precios, promociones, envío ni datos de clientes como parte de esta tarea.

Los apuntes técnicos siguientes se comprobaron al redactar la spec; volver a contrastarlos con el checkout, sin depender de números de línea:

- `b2c/index.html` define `window.CANAL = 'B2C'`; B2B usa el mismo motor con su canal propio.
- `shared/app.js` contiene `agregarAlCarrito(gid, variante, qty, opciones = {})`, que devuelve `true` tras agregar y `false` si bloquea un producto no disponible.
- La reconstrucción de carrito usa `manual: false`, `persistir: false` y `permitirNoDisponible: true`. No cuenta como intención nueva del visitante.
- `enviarWhatsApp()` en móvil abre WhatsApp; en desktop abre primero un selector. La salida real se intenta en `abrirWhatsAppConPedido()`.
- Elegir QR sólo presenta el traslado al teléfono: no abre WhatsApp. El teléfono restaura el pedido y posteriormente puede abrir WhatsApp.
- Catálogo, selección de evento y modales son vistas del mismo HTML: abrirlos no debe generar cargas de página ficticias.
- No se encontraron llamadas `fbq` ni carga `fbevents` en los archivos públicos examinados. Hay un script de Vercel Insights, que se conserva. No se auditó la producción para certificar ausencia total de instalaciones adicionales.
- Existen pruebas con `node:test`, `assert` y `vm`; por ejemplo `tests/event-product-view.test.js`. No incorporar un framework o gestor de paquetes.

## 3. Entradas que deben resolverse

### Cuenta y Pixel

Necesitamos el identificador de la fuente web/Pixel del negocio y verificar que esté asociado a la cuenta publicitaria correcta. No inventarlo ni usar un Pixel ajeno. El identificador del Pixel no es un token secreto; no pedir contraseñas ni poner access tokens en el frontend.

Si todavía no existe, guiar al responsable en el Administrador de eventos: Conectar datos → Web → crear/seleccionar fuente → Pixel únicamente → instalación manual, según las opciones que muestre su cuenta. No crear duplicados sin comprobar primero qué existe. El responsable conserva la titularidad.

No cambiar permisos, aceptar acuerdos ni actuar en cuentas por inferencia. La creación/configuración de cuenta y la validación en Meta se distinguen de la implementación de código.

### Privacidad y activación

El tracking comparte actividad del visitante con un tercero. Antes de activarlo, revisar el mecanismo de privacidad/consentimiento vigente y confirmar con el responsable la modalidad aplicable. No inventar una conclusión jurídica ni publicar una política de privacidad nueva por cuenta propia.

Si falta esa definición o el identificador, avanzar en código local y pruebas con integración deshabilitada. Explicar puntualmente qué falta para activarla; no afirmar que está funcionando en producción. No convertir esta tarea automáticamente en instalar una CMP, un backend o un sistema de cuentas.

## 4. Eventos requeridos

### A. `PageView` — estándar

- Una llamada por carga completa del documento B2C, una vez habilitada la medición y permitida su activación.
- Una aceptación tardía de consentimiento puede originar el primer PageView de ese documento; reinicializar el módulo no debe duplicarlo.
- Una recarga real puede generar otro PageView. No prometer visitantes únicos a partir del conteo de eventos.
- No emitirlo al cambiar de hero, abrir catálogo, filtrar, abrir/cerrar producto, navegar Atrás entre vistas o abrir la selección del evento.

### B. `AddToCart` — estándar

- Emitir una vez tras un agregado manual real, permitido y exitoso al carrito B2C, desde cualquier entrada que reutilice ese flujo.
- Aprovechar la distinción real `opciones.manual !== false` y validar el resultado de la operación. No alterar las reglas comerciales para poder registrar.
- Un agregado rechazado o no disponible no emite evento. No registrar cantidades inválidas.
- No emitir al restaurar sesión, reconstruir desde QR, rehidratar catálogo, renderizar, abrir el carrito ni recalcular promociones/precios.
- En esta versión, editar la cantidad desde los controles internos del carrito no emite `AddToCart`; se mide el agregado desde producto/catálogo/modal. Documentar este alcance.
- Si la misma persona agrega intencionalmente dos veces, son dos acciones válidas. Evitar duplicados técnicos, sin suprimir nuevas acciones reales.
- Parámetros permitidos: `content_ids` con el `Id` de la variante como string, `content_type: 'product'` y `contents` con ese ID y la cantidad añadida. No confundir `Id` con `Id_Grupo`.
- Omitir `value` en esta primera versión para no inventar una segunda lógica monetaria. No enviar costos, margen, proveedor ni información privada de catálogo.

### C. `WhatsAppOrderClick` — personalizado

- Conversión comercial principal según la sección anterior; permite estimar pedidos/ventas manteniendo identificado su origen en un clic.
- Usar exactamente ese nombre y registrar con la API de evento personalizado, no como `Purchase`, `Lead` o conversación completada.
- Representa **el intento deliberado de abrir WhatsApp con un pedido válido**. No prueba apertura exitosa de la app, envío del mensaje, confirmación o cobro.
- Emitir una sola vez por intento en el punto que ejecuta la salida (`abrirWhatsAppConPedido()` o equivalente vigente), con carrito no vacío y sin productos bloqueados.
- En desktop, pulsar el botón que abre el selector todavía no emite. Elegir «Abrir WhatsApp en esta computadora» sí. Elegir QR, visualizarlo o restaurar el pedido en el teléfono no emite; el intento posterior de abrir WhatsApp en el teléfono sí.
- Cancelar el selector no emite. Pulsar un enlace genérico de consulta/contacto tampoco es este evento.
- Parámetros mínimos: canal constante `B2C`, o ninguno. No adjuntar URL `wa.me`, mensaje, teléfono, dirección, nombre, cupón ni contenido completo del pedido.
- El envío del evento nunca debe retrasar la salida, esperar respuestas de red o hacer perder el gesto de usuario que abre la ventana. Un error o bloqueo del Pixel no debe impedir comprar.

### Eventos fuera de alcance

No emitir `Purchase`, `InitiateCheckout`, `Lead`, `Contact`, `ViewContent` ni otros eventos en esta entrega. No medir formularios de novedades ni conversaciones de WhatsApp. No integrar cobros, Apps Script, Finanzas, conversiones offline, catálogos de Meta o CAPI.

No importar datos de clientes ni activar coincidencias avanzadas automáticas. El seguimiento automático de botones y otras funciones opcionales de Meta debe revisarse y desactivarse cuando agregue eventos o datos fuera de este contrato; no confiar en que sólo el código manual controla toda la recolección.

## 5. Arquitectura mínima y tolerancia a fallos

- Mantener HTML/CSS/JS vanilla. Usar instalación directa; sin npm, framework, Tag Manager ni paquetes nuevos.
- Preferir un módulo pequeño, por ejemplo `shared/meta-pixel.js`, cargado exclusivamente desde B2C, y configuración explícita del identificador y de habilitación. Resolver las rutas con el esquema real del despliegue.
- No cargar el SDK ni efectuar requests de Meta en B2B/admin, con integración deshabilitada, sin identificador válido o antes de la autorización de medición definida. La ubicación en `shared/` no implica habilitación compartida.
- Los hooks de `shared/app.js` deben ser seguros si el módulo no existe o falla. No cambiar el flujo ni los valores devueltos por carrito y pedido.
- Carga asíncrona e inicialización idempotente: una carga del SDK y una inicialización por documento/Pixel. Evitar listeners duplicados.
- Resolver correctamente acciones posteriores a la habilitación mientras termina la carga asíncrona. No reconstruir ni reenviar acciones ocurridas antes de autorizar medición.
- Si existe revocación de consentimiento, impedir nuevos eventos y aplicar las medidas correspondientes de Meta; la compra debe seguir funcionando. No inventar persistencia de consentimiento ajena al mecanismo acordado.
- No agregar un fallback `noscript` que envíe requests eludiendo la misma decisión de activación/consentimiento.
- No hacer depender ninguna acción comercial del éxito de Meta ni de extensiones del navegador.
- Datos enviados limitados a este contrato. Revisar también URL, parámetros y configuración automática: no transmitir PII por caminos indirectos. No hacer captura genérica de formularios, texto del DOM o almacenamiento del cliente.
- Mantener una forma explícita y sencilla de deshabilitar la integración para rollback.

No se solicita un dashboard nuevo, identificación de personas, almacenamiento de UTMs, atribución propia, persistencia entre dispositivos ni modificación del popup.

## 6. Pruebas y aceptación

Aplicar las instrucciones TDD vigentes de la sesión. El runner nativo de Node ya se usa en `tests/`: no instalar otro. Ejecutar una línea base antes de modificar y distinguir fallos previos.

Usar un adaptador/transporte falso en pruebas: deben comprobar llamadas y efectos reales, sin contactar Meta ni usar datos personales. Los siguientes comportamientos tienen que quedar cubiertos:

1. Carga B2C autorizada: init y un PageView; doble inicialización no duplica. Una carga de documento nueva sí puede emitir uno nuevo.
2. B2B, admin, deshabilitado, sin ID o medición no autorizada: cero cargas y eventos de Meta, con flujos comerciales funcionales.
3. Consentimiento tardío: sin tráfico previo, primer PageView al habilitar y sin reproducción de acciones anteriores; revocación impide posteriores.
4. Agregado manual exitoso: un AddToCart con variante/cantidad correctas; segundo agregado deliberado genera otro.
5. Agregado rechazado, restauración, QR y actualización de UI/cantidad: ningún AddToCart espurio.
6. Móvil: un intento válido de WhatsApp genera un custom event; carrito vacío o bloqueado, ninguno.
7. Desktop: abrir/cancelar selector o elegir QR no cuenta; elegir salida a WhatsApp cuenta una vez. No doble conteo al pasar por funciones envolventes.
8. Pixel ausente, lento, bloqueado o que falla: carrito y salida conservan su comportamiento y no esperan la medición.
9. No hay llamadas a Purchase ni payloads con información personal, mensajes, costos o parámetros fuera del contrato.

Hacer además verificación manual desktop/mobile del catálogo, agregado, recarga/restauración, selector de envío, QR y salida a WhatsApp. Verificar ausencia de requests de Meta en B2B/admin y con medición no habilitada.

Con Pixel real y acceso autorizado, usar «Probar eventos» para comprobar recepción y los tres nombres. Distinguir esta prueba de las unitarias con mock. No enviar un pedido real ni datos personales para probar; no afirmar validación en Meta o producción si sólo hubo mocks/local.

## 7. Entrega y cierre

Entregar código local mínimo y pruebas, instrucciones de configuración/activación, eventos y límites, resumen de archivos modificados, checks realizados y pendientes. Incluir cómo desactivar el tracking.

Separar claramente: implementado localmente; habilitado; comprobado en Meta; publicado. Una fase no demuestra las demás. No hacer commit, push, PR, merge, despliegue o publicación de anuncios sin que se solicite.

Actualizar la nota de continuidad con resultados y pendientes técnicos. Cualquier actualización de la KB canónica requiere la confirmación prevista en el proyecto; señalar los documentos correspondientes sin editarlos por inferencia.

## 8. Referencias oficiales verificadas al redactar

- [Información sobre el Pixel](https://www.facebook.com/business/help/742478679120153).
- [Configurar e instalar el Pixel](https://www.facebook.com/business/help/952192354843755).
- [Herramienta Probar eventos](https://www.facebook.com/business/help/2040882565969969).
- [Conversiones personalizadas a partir de eventos web](https://www.facebook.com/business/help/780705975381000).

Consultar la documentación vigente al implementar; las pantallas y nombres de opciones pueden cambiar. No asumir acceso a funciones de una cuenta que no se inspeccionó.

## Prompt para la sesión ejecutora

> Implementá localmente el Meta Pixel mínimo para Menos Vueltas B2C según `docs/spec-meta-pixel-b2c.md`. Leé primero esa spec, `docs/continuidad-marketing-b2c.md`, AGENTS.md y la KB relevante.
>
> Medí únicamente PageView, AddToCart manual y WhatsAppOrderClick. Este último es la **conversión comercial principal**, como indicador de pedidos/ventas estimadas. Yo voy a contrastar periódicamente sus eventos con las compras reales. Prepará las instrucciones para crear en Meta la conversión personalizada «Pedido iniciado por WhatsApp» y consultar su conteo y costo, verificando la disponibilidad de la cuenta.
>
> Conservá el nombre técnico WhatsAppOrderClick; no emitas Purchase ni presentes importes de carrito como ingresos cobrados. Evitá duplicados técnicos y documentá cómo afectan al conteo los reintentos del mismo pedido. Registrá la salida efectiva hacia WhatsApp, no sólo abrir el selector desktop o mostrar el QR. Restauraciones de carrito/QR no son nuevos agregados manuales. Preservá el flujo comercial y la separación de B2B/admin.
>
> Guiame para crear o localizar el Pixel y obtener su ID. Antes de habilitar tráfico real resolvamos la configuración de privacidad/consentimiento. Mientras falten esos datos, avanzá con implementación deshabilitada y pruebas locales.
>
> Usá HTML/JS vanilla, los patrones existentes de Node y TDD según las instrucciones de la sesión. No agregues dependencias, backend, CAPI, dashboard ni atribución propia. Verificá desktop/mobile y distinguí pruebas locales con mock, recepción real en Meta y producción.
>
> No publiques, hagas push, cambies permisos ni edites Sheets, Apps Script, condiciones comerciales o KB sin autorización. Cerrá con archivos modificados, pruebas, pendientes y cómo deshabilitar el tracking; actualizá la nota de continuidad.
