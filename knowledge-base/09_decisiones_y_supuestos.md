# Decisiones y supuestos

## Decisiones confirmadas

- Sheets es la fuente de verdad del negocio.
- B2C es la operación comercial activa; B2B es una vertical separada en preparación.
- B2C y B2B deben mantener clientes, precios y lógica comercial separados.
- El precio mayorista depende de cantidad de unidades del mismo producto; no define el precio B2B.
- La marca prioriza “Compra simple” y “Más tiempo para vos”.
- El precio se comunica como competitivo o conveniente, sin construir una propuesta de servicio premium.
- El público objetivo puede incluir barrios privados; la estética se mantiene accesible y no premium.
- La identidad visual vigente toma como referencia el Brand Book de Canva: verde oliva, fondo cálido claro, grafito, DM Sans, Cabin e iconografía Tabler.
- El hero público se implementa como un multihero compartido por B2C y B2B: `hero-actual` en la primera posición, `hero-estandar` en la segunda y bloques HTML extra independientes cuando se definan. Cada canal conserva su contenido y acciones propios. B2C tiene activo en su primer bloque el hero de campaña “Comer mejor”; B2B conserva ese bloque vacío hasta definir su propia pieza.
- El multihero rota automáticamente cada ocho segundos y el punto activo se completa progresivamente para anticipar el siguiente desplazamiento. La navegación manual reinicia el conteo; en desktop usa flechas y en mobile swipe horizontal, sin flechas visibles.
- El multihero se pausa al interactuar, cuando la pestaña pierde visibilidad, si el sistema solicita reducción de movimiento y mientras se mantiene el dedo sobre él en mobile. No se pausa al pasar el cursor en desktop y no incluye un botón permanente para detener la rotación.
- Todo hero debe respetar relación 16:7 en desktop/tablet (guía 1600 × 700 px) y 9:13 en mobile (guía 1080 × 1560 px), incluso cuando tenga imágenes, botones o contadores distintos.
- El hero B2C “Comer mejor” usa artes finales separados para desktop y mobile, sin recortar la composición de productos. Título, bajada y CTAs permanecen como HTML; “Ver selección” abre la vista-evento y “Ver catálogo” conserva el acceso al catálogo normal.
- B2C puede incorporar una `vista-evento` editorial temporal, accesible sólo desde el CTA de un hero. Su configuración vinculada al hero define activación, textos, CTA y `Id_Grupo` explícitos y ordenados; no infiere productos ni crea una ruta permanente. Sólo muestra grupos activos del catálogo B2C y al retirar el CTA junto con su definición queda inaccesible. B2B, menú, filtros, buscador y catálogo normal no exponen esta vista.
- Las tarjetas de una `vista-evento` son instancias propias para no duplicar IDs ni reutilizar nodos del catálogo; abren el modal habitual de producto y, al cerrarlo, conservan el foco en la tarjeta de origen. No fija un producto destacado: todos los grupos configurados se presentan al mismo nivel.
- La primera selección de “Comer mejor” queda activa sólo con Huevos Caseros (`Id_Grupo` 280), hasta contar con los `Id_Grupo` reales de los demás productos previstos. No se inventan ni infieren IDs desde el arte o sus categorías.
- WhatsApp es el canal de cierre y coordinación.
- La prioridad comercial inmediata es alcanzar y sostener 10 pedidos B2C semanales; la validación activa de segmentos de mayor poder adquisitivo queda después de ese objetivo.
- La primera campaña de adquisición fuera del círculo cercano se prueba mediante visitas puerta a puerta en 21 de Julio. Busca captar contactos B2C interesados por WhatsApp; el seguimiento es manual y los contactos inactivos durante tres o cuatro semanas pueden retirarse de la lista o recibir comunicaciones con menor frecuencia.
- El beneficio de bienvenida de la campaña en 21 de Julio es 10% de descuento y no incluye envío gratis.
- La política de envío B2C vigente es $1.500 fijo dentro de la cobertura actual y gratis desde $35.000 netos de productos, después de promociones y descuentos por cantidad. B2B no adopta esta política.
- `Envio` es un campo monetario histórico propio del pedido: `1500` cobrado, `0` bonificado y vacío si el pedido histórico no lo registraba. Al calcular el panel, ese vacío equivale a `$0` sin backfill; el total incluye envío y extras, y la ganancia visible es antes del costo logístico.
- El Apps Script debe leer y escribir `Envio` por encabezado y no se hará backfill de pedidos anteriores.
- Los códigos promocionales se configuran directamente en la pestaña `Codigos_Promo` de Google Sheets y aplican exclusivamente a B2C.
- Sólo se admiten códigos porcentuales, uno por pedido; no hay descuentos fijos ni descuentos sobre el envío.
- Los productos con promoción temporal se excluyen del código. Los descuentos por cantidad continúan siendo elegibles y pueden combinarse con él.
- El envío se recalcula sobre el neto de productos después del código promocional.
- Los precios comunicados y calculados en B2C son múltiplos de $50, incluso con promoción temporal, descuento por cantidad o código. Se redondean al valor más cercano y, en empate, hacia abajo; B2B conserva sus precios propios.
- La condición de primera compra se controla manualmente en WhatsApp durante esta versión. Una futura automatización sólo debería consumir el beneficio al entregar el pedido.
- `Codigo_Promo`, `Porcentaje_Codigo` y `Descuento_Codigo` son datos históricos del pedido y permanecen separados del descuento propio de los productos.
- El carrito web es temporal: se guarda por pestaña y por canal mediante `sessionStorage`, únicamente con identificadores y cantidades. No persiste entre sesiones ni almacena datos personales, precios o condiciones calculadas.
- Al restaurar o importar un carrito por QR, la web usa el catálogo vigente y revalida el código promocional B2C antes de aplicarlo; un QR reemplaza el estado temporal previo del canal.
- La invitación B2C a recibir novedades se muestra una sola vez por sesión, 30 segundos después del primer agregado manual al carrito. No se considera una señal de intención la restauración, el QR ni el scroll; la invitación no debe impedir interactuar fuera de su panel y en móvil se puede descartar mediante arrastre.
- El modelo actual es compra contra pedido y retiro en distribuidora, no stock propio en tiempo real.
- La planilla operativa privada contiene `Proveedores`; `Productos.Id_Proveedor` es una FK privada hacia el proveedor habitual. Los códigos legacy se conservan como `Codigo_Proveedor`, sin reinterpretarlos como proveedores.
- Las modalidades de abastecimiento admitidas son exactamente `CONTRA_PEDIDO`, `CONSIGNACION` y `STOCK_PROPIO`. Los históricos no clasificados continúan sin backfill y se interpretan de forma compatible como contra pedido, sin stock gestionado y con `Sin_Stock = false`.
- `Movimientos_Stock` es un ledger privado append-only. Sus movimientos relevantes son ingreso, venta, consumo propio, rotura/merma y corrección; la idempotencia evita duplicar operaciones en reintentos y una corrección agrega un movimiento nuevo, sin editar el antecedente.
- Todo ingreso nuevo registra su `Modalidad_Abastecimiento` histórica privada como `STOCK_PROPIO` o `CONSIGNACION`. Las tandas/capas de costo, asignaciones FIFO y faltantes se reconstruyen sólo en lectura desde el ledger; no existe una hoja ni fuente de verdad adicional.
- FIFO respeta el orden append-only del ledger. Un faltante de costo queda pendiente y el próximo ingreso del mismo producto lo cubre antes de abrir remanente; las correcciones positivas restauran automáticamente sólo los tramos reversibles de la salida referida.
- La valorización privada separa capital propio, consignación y valor físico conocido. El legado con costo válido pero sin modalidad puede integrar sólo este último y debe advertir composición histórica incompleta; el legado sin modalidad ni costo es no valorizable.
- No hay backfill automático de modalidad o costo histórico. Sólo puede realizarse una normalización manual puntual cuando se conoce la modalidad histórica real; nunca se infiere desde la clasificación vigente del producto.
- Inventario muestra un resumen compacto y un detalle/historial privado de sólo lectura. Sus etiquetas son humanas y no exponen identificadores técnicos, PII, datos de B2C/B2B, cobros ni Finanzas.
- `Sin_Stock` es una decisión manual global, independiente del saldo. Se publica únicamente como booleano, con `false` por defecto; conserva el producto visible pero impide nuevas compras en ambos canales.
- Cada línea nueva de pedido conserva un `Item_Id` y snapshot de proveedor, modalidad y gestión de stock. Los cambios de catálogo no reinterpretan ese snapshot y los históricos sin él no reciben backfill ni movimientos retrospectivos.
- La transición a `Entregado` genera ventas negativas sólo para las líneas cuyo snapshot gestiona stock. Es un hito de entrega física, no de cobro; Finanzas conserva el registro de cobros reales.
- Las listas privadas de abastecimiento son de sólo lectura: usan únicamente snapshots completos de pedidos activos `CONTRA_PEDIDO`, agrupados por canal, proveedor habitual y modalidad. Excluyen consignación, stock propio, cancelados, entregados e históricos incompletos, sin inferir ni completar datos. Distrosec conserva una proyección agregada compatible.
- La prioridad técnica es velocidad y bajo costo.
- Entender el código e incorporar funcionalidades tiene prioridad sobre eliminar código muerto.
- Una futura reescritura con buenas prácticas es deseable, pero no inmediata.

## Supuestos a validar antes de automatizar

- Los datos publicados desde Sheets son suficientes y consistentes para alimentar las vistas web.
- Los estados actuales del panel representan adecuadamente el flujo operativo.
- La frecuencia de un retiro semanal seguirá siendo viable mientras crezca la base de clientes.
- La preferencia previa del cliente ante sustituciones no está formalizada. El tratamiento actual de faltantes y cambios se detalla en las reglas y flujo B2C.
- La exposición pública actual de ciertos datos de catálogo/costos es conocida y aceptada por el responsable, pero no debe interpretarse como recomendación de seguridad.

## Límites para agentes

- No redistribuir datos personales encontrados en Sheets.
- No cambiar precios, costos, márgenes, promociones, estados ni políticas de envío sin indicación explícita.
- No mezclar funcionalidades, métricas ni bases de clientes B2C y B2B.
- No asumir stock en tiempo real ni que una venta del panel equivale a cobro real.
- No iniciar una reescritura total como parte de una mejora puntual sin autorización explícita.
