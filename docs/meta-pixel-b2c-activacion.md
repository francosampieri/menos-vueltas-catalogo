# Meta Pixel B2C — configuración, verificación y operación

**Estado publicado, 6 de noviembre de 2026:** el responsable autorizó por única vez commit, integración y push de la activación. Commit `92c9d18`, creado en `feature/pixel`, integrado por avance directo y publicado en `main`. Vercel confirmó éxito; `https://menosvueltas.com.ar/` responde 200 con `enabled: true`, ID correcto y arranque automático `setConsent(true)`; `/meta-pixel.js` responde 200 JavaScript. **La activación automática ya está publicada**, sin aviso ni solicitud de consentimiento. No se modificó el contrato de eventos ni se enviaron eventos reales adicionales desde el agente. Para comprobar una visita nueva, recargar la web pública sin comandos y luego Meta; la recepción histórica de los tres eventos y la conversión ya fue confirmada por el responsable. Para apagar nuevas cargas, cambiar a `enabled: false` y publicar; para la pestaña actual, `window.MVMetaPixel.setConsent(false)` hasta su próxima recarga. Autorización de publicación única consumida. Esta guía y la continuidad siguen locales, fuera del commit público. Los registros siguientes describen las etapas previas y la implementación.

**Estado vigente, 6 de noviembre de 2026:** por instrucción explícita posterior «activemos todo sin privacidad y consentimiento», el cambio local de `feature/pixel` inicia automáticamente el Pixel B2C, sin aviso ni solicitud de consentimiento. `enabled` está en `true` y el HTML llama automáticamente a `setConsent(true)`; es una habilitación técnica decidida por el responsable, no consentimiento obtenido del visitante. No se concluye cumplimiento jurídico o contractual. **Aún no publicado:** sin commit/push/despliegue en esta etapa; producción sigue apagada en `33ba5cc`. Los registros anteriores de espera de privacidad y pruebas voluntarias describen la etapa previa, no el comportamiento local actual. El alcance sigue limitado a tres eventos B2C; no se amplían datos ni se retiran filtros de URL/referrer. La publicación requiere autorización específica.

**Reporte configurado el 6 de noviembre:** la conversión se conectó a la cuenta publicitaria cuyo ID termina en `6852` desde **Configuración → Conversiones personalizadas → Conectar activos**. Después apareció en **Columnas → Personalizar columnas**. El responsable mostró **Total** y **Costo** seleccionados para «Pedido Iniciado por WhatsApp», junto con **Campaña** y **Monto gastado**, sin **Valor**. Se indicó aplicar y guardar la vista «Menos Vueltas B2C»; el guardado no está confirmado. Nunca hubo campañas ni gasto según el responsable, por lo que todavía no se validan atribución ni costo con una campaña real. Recepción y coincidencia de conversión sí están confirmadas. Sigue pendiente resolver privacidad/autorización para activar la medición general; el sitio continúa apagado por defecto.

**Actualización del 6 de noviembre de 2026:** el responsable confirmó que Meta recibió como procesados PageView, AddToCart y WhatsAppOrderClick y mostró la conversión personalizada «Pedido Iniciado por WhatsApp» para los intentos desde el dominio principal. Recepción y coincidencia de la conversión quedan validadas por ese reporte. Cada evento de salida y su conversión derivada describen el mismo intento, no se suman como pedidos separados. El diagnóstico adicional de consola no fue necesario porque la actividad terminó apareciendo. El código publicado continúa apagado para medición general; falta preparar las columnas de cantidad/costo y resolver la activación general. La autorización de push anterior fue única y ya se utilizó.

Estado al 5 de noviembre de 2026: código y pruebas en `feature/pixel` y `main` remoto, commit `33ba5cc`, **deshabilitado por defecto**, desplegado en `https://menosvueltas.com.ar/` y con preview HTTPS de Vercel. El responsable autorizó explícitamente push/despliegue **sólo por esta vez**, para probar con la regla de la conversión del dominio principal. Ese permiso no habilita futuros pushes ni medición general. Esta guía, la spec y la continuidad permanecen locales y no se incluyeron en el commit público. El ID es `932328919811200`; no se pegó snippet duplicado ni fallback `noscript`. El responsable confirmó cuenta asociada, ajustes automáticos apagados y recepción de la prueba local tras recargar Meta. Falta validar la conversión personalizada desde el dominio principal. No se agrega banner, política, CMP ni otra interfaz. La modalidad para habilitar medición general de visitantes sigue pendiente.

## 1. Localizar o crear la fuente web y obtener el ID

Los pasos son orientativos: deben contrastarse con las opciones y permisos que muestre la cuenta. No se accedió a la cuenta Meta. La consulta de las referencias oficiales durante la implementación devolvió login/bloqueo o HTTP 429; no se certificó una interfaz actual de esa cuenta.

1. Ingresar con la cuenta propia al [Administrador de eventos](https://business.facebook.com/events_manager2/) y comprobar que esté seleccionado el negocio correcto.
2. Revisar **Orígenes de datos / Conjuntos de datos** antes de crear nada. Si aparece una fuente web de Menos Vueltas, abrirla y comprobar su titularidad y uso. Evitar duplicados.
3. Si no existe: **Conectar datos → Web → Conectar / Crear**. Usar un nombre reconocible, por ejemplo «Menos Vueltas B2C». Elegir la opción de **Pixel de Meta solamente** e **instalación manual**, si está disponible. No configurar CAPI, pasarelas, integraciones de socios ni paquetes adicionales.
4. En **Configuración** de la fuente, copiar el **ID del Pixel / conjunto de datos web** que Meta indique para instalar el Pixel. Es un número, no un access token. Si las etiquetas no coinciden o la opción Web está bloqueada, revisar la pantalla antes de crear otra fuente o cambiar permisos.
5. Comprobar que la cuenta publicitaria B2C correcta pueda utilizar esa fuente. Cualquier cambio de permisos o aceptación de acuerdos lo realiza el responsable conscientemente; esta implementación no los modifica.
6. En la configuración del Pixel, revisar y mantener desactivadas **coincidencias avanzadas automáticas** y **seguimiento automático de eventos sin código**. No usar la herramienta de configuración visual para agregar eventos adicionales. El código también fija `autoConfig: false` antes de `init`, sin datos de usuario.
7. Compartir sólo el ID numérico para completar la configuración. No pegar el snippet completo de Meta: duplicaría esta instalación. No compartir contraseñas ni tokens.

Referencias de Meta: [instalación manual](https://www.facebook.com/business/help/952192354843755), [implementación del Pixel](https://developers.facebook.com/docs/meta-pixel/implementation/).

## 2. Activación automática solicitada

El responsable pidió posteriormente activar sin privacidad y consentimiento. Se implementó esa decisión sin agregar interfaz. Esta instrucción cambia la configuración técnica solicitada; no demuestra consentimiento del visitante ni determina el cumplimiento de las [condiciones de las herramientas empresariales de Meta](https://www.facebook.com/legal/technology_terms).

Configuración local en `b2c/index.html`:

```js
window.META_PIXEL_B2C = { enabled: true, pixelId: '932328919811200' };
```

Después de cargar `meta-pixel.js`, el HTML habilita automáticamente el módulo si el interruptor está encendido. No se consulta ni persiste una elección del visitante. El módulo sigue verificando canal B2C, ID válido, URL/referrer admitidos y ausencia de instalaciones de Pixel preexistentes.

La llamada de arranque está protegida para que una falla o ausencia del módulo no interrumpa los scripts del carrito:

```js
try {
  if (window.META_PIXEL_B2C.enabled) window.MVMetaPixel?.setConsent(true);
} catch (_) { /* El carrito y WhatsApp no dependen de Meta. */ }

// Para detener los eventos de la pestaña actual:
window.MVMetaPixel.setConsent(false);
```

Cada documento elegible inicia un PageView. Reinicializar no lo duplica. Detener mediante `setConsent(false)` descarta eventos pendientes; no borra eventos ya recibidos ni solicitudes que ya salieron. Recargar vuelve a iniciar automáticamente si `enabled` sigue en `true`. El interruptor `false` impide la carga del SDK incluso con la llamada automática presente.

No se autoriza desplegar por completar estos pasos. Al publicar en una futura tarea, incluir `shared/meta-pixel.js` en el mismo esquema de recursos compartidos que expone `app.js` y `shipping.js` como archivos hermanos del HTML B2C. B2B y admin no deben incluir el módulo. Verificar que `meta-pixel.js` responda como JavaScript, sin 404 ni fallback HTML.

## 3. Verificar recepción real en Meta

**Resultado posterior confirmado por el responsable:** Meta ya había recibido la prueba local. Al **recargar la página de Meta**, vio dos PageViews y los eventos de carrito/salida de pedido anteriores. No fue necesario un merge para recibirlos. La publicación del preview resultó innecesaria para resolver esa falta de actualización visual. Si una pantalla no refleja eventos, recargarla y comprobar fuente/rango antes de inferir rechazo de localhost o preparar otro despliegue. No confundir el rechazo de la URL por el botón Probar eventos con rechazo de solicitudes recibidas. La recepción de esta prueba no habilita medición general ni acredita compras cobradas. Crear la conversión personalizada sobre `WhatsAppOrderClick`, no sobre Purchase.

### Prueba HTTPS preparada después del rechazo de localhost

La vista previa es [menosvueltas-b2c-ov8vio4bb-francosampieris-projects.vercel.app](https://menosvueltas-b2c-ov8vio4bb-francosampieris-projects.vercel.app/). Vercel informa éxito. Se verificaron HTTP 200 para `/`, `/meta-pixel.js` y `/app.js`, tipos correctos, config `enabled: false` y hooks publicados. En navegador se comprobó inclusión del módulo y cero scripts SDK de Meta antes de autorización. El agente no habilitó ni emitió eventos en este preview.

1. En Meta → Probar eventos, usar la URL HTTPS de preview y pulsar Probar eventos si la cuenta la acepta.
2. En la vista previa que se abre, la medición continúa apagada. El responsable puede autorizar **sólo su prueba en esa pestaña** mediante F12 → Consola y estas dos líneas, entendiendo que enviarán su actividad de prueba a Meta:

```js
window.META_PIXEL_B2C.enabled = true;
window.MVMetaPixel.setConsent(true);
```

3. Volver a Meta y comprobar si recibe PageView. Todavía no se confirmó recepción en este entorno. Después comprobar los otros dos eventos y crear la conversión personalizada, siguiendo los pasos de este documento.
4. Al finalizar, ejecutar `window.MVMetaPixel.setConsent(false)` o cerrar la pestaña. Una recarga arranca apagada nuevamente. No cambia archivos ni habilita medición para otros visitantes.

La vista previa contiene el flujo real de salida a WhatsApp, no la simulación del servidor local: no enviar un mensaje/pedido para probar el evento web. No usar datos de clientes. El servidor local temporal se detuvo al pasar a esta prueba HTTPS.

Estas comprobaciones siguen **pendientes**: ya se recibió el ID del Pixel, pero no se habilitó tráfico real. Las pruebas locales usan transporte falso; no acreditan recepción en Meta.

Durante la guía, el responsable comprobó que su pantalla de Probar eventos deja el botón deshabilitado para `http://localhost:8765/b2c/`. No insistir en ingresar esa dirección en Meta. La herramienta local externa al repositorio muestra ahora diagnóstico de carga del SDK y solicitudes de eventos observadas tras activación voluntaria propia; observar una solicitud **no equivale a recepción confirmada**. La validación real en Meta sigue pendiente. Publicar una vista previa para obtener una URL aceptada es una acción separada que requiere autorización; no hacer merge ni desplegar como consecuencia implícita de esta limitación.

Resultado local informado por el responsable: **SDK cargado y solicitud PageView observada**. Se distingue de la suite con transporte falso: hubo una solicitud real del navegador en su prueba voluntaria, pero aún no hay recepción confirmada por Meta. AddToCart y WhatsAppOrderClick reales siguen pendientes. El diagnóstico local lista nombres, no cantidad de requests; no usarlo para afirmar ausencia de duplicados.

Actualización posterior: el responsable completó el recorrido guiado y confirmó los tres eventos emitidos localmente, sin WhatsAppOrderClick al abrir selector o mostrar QR. La recepción por Meta aún no está confirmada: revisar primero **Resumen** de la fuente para comprobar si aparecen PageView, AddToCart y WhatsAppOrderClick. No inferir rechazo de eventos sólo porque el campo de prueba no admite localhost. No se hizo merge ni se publicó.

1. Tras resolver el punto 2 y autorizar la prueba, abrir la fuente correcta en **Probar eventos**. Introducir la URL B2C del entorno autorizado si la herramienta lo permite. No usar B2B/admin ni activar producción por inferencia.
2. Abrir un documento nuevo y autorizar medición conforme a la modalidad acordada: comprobar un único `PageView`. Abrir catálogo, producto, selección del hero o cambiar de vista no agrega PageViews. Recargar sí puede agregar uno.
3. Agregar una variante disponible con cantidad válida: comprobar un `AddToCart`, con `content_ids` = ID de **variante**, `content_type: product` y `contents` con ID/cantidad añadida. Agregar deliberadamente otra vez genera otro. No debe haber `value`, costos ni datos de clientes.
4. Recargar, abrir carrito, importar por QR o editar cantidades internas: no generan `AddToCart`. Un producto bloqueado tampoco.
5. Desktop: abrir/cancelar el selector o elegir QR no genera `WhatsAppOrderClick`. Elegir «Abrir WhatsApp en esta computadora» genera uno. Mobile: «Enviar pedido» genera uno con pedido válido. Carrito vacío o con productos bloqueados: ninguno.
6. Revisar que `WhatsAppOrderClick` sea personalizado y lleve únicamente `{ channel: 'B2C' }`. No deben aparecer `Purchase`, `Lead`, otros eventos automáticos, texto del pedido ni enlace de WhatsApp en los payloads.
7. Para probar la salida sin datos reales, usar productos públicos y cantidades de prueba; no completar datos de clientes ni pulsar **Enviar mensaje** en WhatsApp. El evento representa el intento web, no requiere enviar el mensaje. Los eventos de prueba no prueban atribución publicitaria ni compras.
8. En DevTools → Red, revisar `fbevents` y `facebook.com/tr`, incluidos URL/documento y referrer. Antes de autorización, con flag apagado, sin ID, en B2B/admin: cero requests de Meta de esta integración. Probar rechazo/revocación y bloqueador: carrito y salida deben seguir funcionando. Si hubiera otra instalación, auditarla antes de habilitar esta.
9. Revisar **Diagnóstico** y posibles verificaciones de evento/dominio que exija la cuenta. No prometer elegibilidad para optimización hasta comprobarla.

Referencia: [Probar eventos de Meta](https://www.facebook.com/business/help/2040882565969969).

### URLs y cobertura de medición

El SDK puede leer URL y referrer aunque no se agreguen como parámetros del evento. El módulo sólo inicia/envía sobre rutas públicas conocidas (`/`, `/index.html`, `/b2c/`, `/b2c/index.html`), sin hash, credenciales ni queries arbitrarias. Sólo admite `fbclid` con caracteres acotados; **no lo exige**. No cambia la URL ni captura UTMs.

Esto permite visitas directas, desde WhatsApp, Google o anuncios cuando su contexto es seguro. Si la URL o el referrer contienen otros parámetros, hashes o rutas no admitidas, se omite medición para preservar privacidad. También se omiten actualmente URLs con UTMs: antes de usarlas en campañas, revisar expresamente qué valores pueden compartirse y ampliar la política probada si corresponde. No limpiar parámetros silenciosamente ni incorporar PII en URLs de campañas. El QR limpia su hash por el flujo existente; al terminar de restaurar se llama `init()` nuevamente, sin generar agregados nuevos.

No hay promesa de cobertura completa: consentimiento, bloqueadores y controles del navegador también reducen lo observable. Una instalación global preexistente de `fbq`/`_fbq` detiene esta integración para evitar compartir eventos con píxeles desconocidos.

## 4. Crear «Pedido iniciado por WhatsApp»

**Actualización de publicación:** tras el rechazo inicial, el responsable autorizó explícitamente el push de main sólo por esta vez. Al ejecutarlo, remoto ya estaba actualizado en `33ba5cc`. Vercel y HTTP confirman el código en el dominio principal con `enabled:false`; no se activó para visitantes. Ahora puede probarse la regla desde la web principal habilitando exclusivamente la pestaña del responsable con las dos líneas de consola indicadas arriba. La salida a WhatsApp es real: no enviar el mensaje. Al finalizar, recargar/cerrar la pestaña o revocar consentimiento. Recargar también la pantalla Meta para comprobar actividad/conversión antes de concluir que falta recepción.

El responsable ya confirmó la creación siguiendo esos campos, con regla obligatoria **URL contiene `https://menosvueltas.com.ar/`**. Las pruebas anteriores de localhost y preview no cumplen esa regla. Falta verificar un nuevo WhatsAppOrderClick desde el dominio principal y consultar cantidad/costo. Se integró localmente el commit `33ba5cc` en main, con medición por defecto apagada, pero el push de main fue rechazado por la revisión automática: requiere autorización explícita de publicación/push, diferenciada del permiso de merge para pruebas. Main remoto y producción siguen sin esa integración. No evadir el rechazo ni activar seguimiento general; una vez autorizado y publicado, probar sólo la pestaña del responsable con las dos líneas de consola del apartado HTTPS.

Una vez recibido el evento en la fuente correcta:

1. Abrir **Conversiones personalizadas → Crear conversión personalizada**, según el menú de la cuenta.
2. Nombre exacto: **Pedido iniciado por WhatsApp**. Descripción sugerida: «Intento web válido de abrir WhatsApp con pedido B2C; indicador de pedidos/ventas estimadas».
3. Seleccionar la fuente web/Pixel B2C. Elegir el evento **WhatsAppOrderClick**, respetando mayúsculas. La condición es ese evento, no una visita general ni un clic en cualquier botón. Si obliga a agregar una regla de URL, limitar al dominio B2C correcto, nunca `wa.me` ni el dominio B2B.
4. Si solicita categoría, usar una categoría neutral disponible y coherente, como «Otro»; no etiquetarlo como compra completada. **No emitir ni configurar Purchase** para este hito.
5. No asignar valor monetario a la conversión. Crear y verificar su estado tras una nueva prueba autorizada. Si el evento no aparece, resolver recepción/permisos/validación antes de reemplazarlo por otro evento.
6. Confirmar que la conversión esté disponible para la cuenta publicitaria correcta. Su posible selección para optimizar una campaña web depende de esa cuenta y del objetivo/configuración. Una campaña directa a WhatsApp no empieza a optimizar por este evento web automáticamente.

Referencia: [conversiones personalizadas de eventos web](https://www.facebook.com/business/help/780705975381000).

## 5. Consultar cantidad y costo

1. En Ads Manager, seleccionar la cuenta B2C y el período deseado.
2. Ir a **Columnas → Personalizar columnas**, buscar **Pedido iniciado por WhatsApp** y agregar su **cantidad/total** y **costo por conversión**, si están disponibles. Agregar **Importe gastado** y guardar la vista.
3. Revisar el período y la configuración/ventana de atribución usados. Ads Manager muestra conversiones atribuidas a anuncios; el conteo recibido por Events Manager puede incluir otros orígenes y no tiene por qué coincidir.
4. Interpretar el costo como gasto publicitario dividido por conversiones atribuidas de este hito. No es automáticamente costo por comprador único ni costo total con impuestos/cargos. Con cero conversiones el costo puede figurar sin dato; no interpretarlo como cero.
5. Comparar periódicamente el conteo con pedidos recibidos y compras reales del mismo período mediante la operación existente. Separar clientes nuevos cuando corresponda. No calcular ingresos cobrados ni ROAS a partir de importes de carrito.

**Reintentos:** hay una sola llamada por cada ejecución válida de salida. El envoltorio mobile y el selector desktop no agregan otra llamada. Si la persona vuelve y abre WhatsApp otra vez deliberadamente, cuenta otro evento, aunque sea el mismo carrito. Un popup bloqueado también puede haber sido un intento contado. Recargar produce otro PageView; un agregado deliberado repetido produce otro AddToCart. No hay identidad, pedido único ni deduplicación entre dispositivos.

## 6. Deshabilitar

- Para nuevas cargas: dejar `enabled: false` en `b2c/index.html`. Conservar el ID no vuelve a habilitarlo. Una futura publicación del flag apagado será necesaria para afectar producción.
- Para un documento ya abierto y autorizado: `window.MVMetaPixel.setConsent(false)` impide nuevos eventos y descarta pendientes propios. Cambiar el archivo local no afecta pestañas remotas ya abiertas.
- Para retirar la integración por completo: quitar configuración y script de B2C. Los hooks opcionales del motor no requieren el módulo para comprar.

## 7. Evidencia local

**Activación automática posterior:** línea base 129/129; dos fallos esperados al exigir arranque automático en el HTML; GREEN 16/16 del Pixel y triangulación desktop/móvil 17/17. Suite completa final **131/131**. Verificación manual con SDK falso y WhatsApp interceptado sólo por un servidor efímero externo al repositorio: desktop 1280×720 y móvil 390×844. Inicio automático con un PageView; agregado manual con un AddToCart; recarga restaura carrito sin agregado; selector/QR no cuentan; salida válida suma WhatsAppOrderClick. Sin errores de consola en el flujo móvil. No se emitieron eventos reales adicionales hacia Meta. El servidor se detuvo al terminar.

| Tarea | Prueba / capa | Safety net | RED | GREEN | Triangulación | Refactor |
|---|---|---|---|---|---|---|
| Inicio automático B2C | `tests/meta-pixel.test.js`, HTML real + VM/SDK falso | 129/129 | 2 fallos: flag apagado y arranque inexistente | 16/16 Pixel | 17/17: desktop/móvil, carga lenta, repetición, apagado, canales, módulo ausente | No necesario |

**Registro de implementación inicial:**

Runner nativo, sin dependencias: `node --test tests/*.test.js`. Línea base: **114/114**. Al cierre: **129/129**, incluidas 15 pruebas nuevas del módulo en `tests/meta-pixel.test.js`. `git diff --check` sin errores.

| Tarea | Prueba / capa | Safety net | RED | GREEN | Triangulación | Refactor |
|---|---|---|---|---|---|---|
| Carga, autorización, cola y privacidad | `tests/meta-pixel.test.js`, unidad VM/SDK falso | 114/114 | 8 fallos iniciales; módulo inexistente | 8 casos aprobados | documento nuevo, canales, revocación antes/después de carga, datos inválidos, fallos SDK | No necesario |
| Hooks carrito/WhatsApp | mismo archivo, integración de funciones reales del motor | 114/114 | 3 fallos: faltaban eventos y guard de carrito vacío | 12 casos aprobados | repetición, bloqueo, restauración, QR, selector, transporte ausente/roto | No necesario |
| Contrato de datos, coexistencia y restauraciones | mismo archivo, triangulación | Conservado | cubierto por RED anterior | 15 casos aprobados | payloads exactos, sin user data, píxel preexistente, restauración por sesión/QR | No necesario |
| Incorporar ID real sin habilitar tráfico | mismo archivo, configuración ejecutada en VM | 15/15 relevantes | Fallo por ID vacío | 15/15 relevantes | ID válido con flag apagado no carga SDK ni emite, incluso al autorizar y realizar acciones | No necesario |

La verificación visual usa el sitio local con SDK deshabilitado y `window.open` sustituido **sólo en el servidor temporal de QA**, sin cambiar el código publicado. No se envía ningún pedido. Las funciones y eventos habilitados se verifican con el transporte falso en VM; no se descargó el SDK real para estas pruebas.
