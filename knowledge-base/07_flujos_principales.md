# Flujos principales

## Flujo B2C: compra y entrega

1. El cliente visita la web B2C o, si tiene dificultades para usarla, envía una lista escrita por WhatsApp para que el equipo arme el pedido de forma asistida.
2. Explora catálogo, precios, promociones y condiciones de compra por cantidad.
3. Agrega productos al carrito; este calcula el neto de productos, el envío B2C y el total. Si el neto alcanza $35.000, el envío es gratis; de lo contrario es $1.500.
4. Envía a WhatsApp un resumen que incluye productos, envío y total. El equipo recibe el pedido, solicita o confirma dirección y acuerda día y horario dentro de la cobertura vigente.
5. La entrega B2C se organiza actualmente para los viernes. Los pedidos ingresados hasta el jueves a las 16 h pueden entrar en esa tanda; se recomienda realizar el pedido entre martes y miércoles. Los posteriores al corte sólo entran si sigue siendo viable; los pedidos del viernes pasan a la semana siguiente, previa comunicación al cliente.
6. Los pedidos acordados se agrupan para enviar a la distribuidora.
7. El equipo retira los productos, normalmente en una única visita semanal. Si detecta un faltante con tiempo, consulta al cliente por WhatsApp; si lo detecta durante el retiro, puede elegir una alternativa equivalente y debe informarla al entregar.
8. El pedido se entrega a domicilio. El cliente puede rechazar una sustitución no consultada y ese producto se elimina del pedido.
9. El cliente paga en efectivo o transferencia al momento de la entrega.
10. La operación financiera real se registra en Finanzas.

## Flujo B2C: código promocional

1. La persona ingresa un único código en el carrito B2C.
2. La web normaliza y consulta sólo ese código a Apps Script; se valida canal B2C, estado, porcentaje y vigencia.
3. Si es válido, se descuenta el porcentaje sobre los productos elegibles, cada precio final se redondea al múltiplo de $50 más cercano y se recalcula el envío sobre el neto. Los productos con promoción temporal quedan excluidos.
4. El mensaje de WhatsApp muestra el precio anterior y final de cada producto con descuento, más el ahorro total. El código se conserva al transferir el carrito por QR al teléfono.
5. Al importar el pedido, el panel revalida el código. El equipo comprueba manualmente que corresponda a primera compra; si no corresponde, lo retira y se recalculan descuento, envío y total.
6. Al guardar el pedido quedan registrados el código, su porcentaje y el descuento aplicado, independientes de cambios posteriores en la campaña.

## Flujo de carrito temporal y QR

1. Al agregar un producto manualmente, la web guarda únicamente sus identificadores y cantidades en el almacenamiento temporal de la pestaña y del canal actual; B2C y B2B no comparten ese estado.
2. Al recargar, la web restaura el carrito sin abrirlo y lo reconstruye con el catálogo vigente. Si hay un código promocional B2C, lo revalida antes de recalcular el pedido.
3. Al abrir un QR, el contenido recibido reemplaza el carrito temporal existente del canal correspondiente. Los productos se reconstruyen desde el catálogo actual y cualquier código B2C se revalida.
4. Treinta segundos después del primer agregado manual B2C de la sesión, la web muestra la invitación de novedades una sola vez. Si hay un modal de producto abierto, espera a que se cierre; la restauración, el QR y el scroll no la disparan.

## Flujo B2C: pedido al costo de uso interno

1. El equipo crea o edita un pedido B2C en el panel y activa la marca de pedido al costo.
2. El panel cotiza las líneas con sus costos unitarios, fija envío y extras en $0 e ignora promociones, códigos promocionales y descuentos por cantidad.
3. Al guardar, el pedido conserva la marca `Pedido_Al_Costo` y sus valores históricos.
4. El pedido permanece en la lista operativa y se selecciona normalmente al armar el pedido a la distribuidora.
5. El pedido no aporta a métricas ni a estadísticas comerciales o de clientes.

## Flujo B2C: captación inicial fuera del círculo cercano

1. El equipo realiza visitas puerta a puerta en una zona piloto de cobertura, actualmente 21 de Julio, y entrega una tarjeta promocional.
2. La persona interesada inicia una conversación por WhatsApp para recibir el beneficio de bienvenida definido para la campaña: 10% de descuento, sin envío gratis.
3. El equipo entrega el beneficio y comparte el acceso al catálogo B2C.
4. Se etiquetan para seguimiento manual los contactos que se inscriben en el formulario de novedades, inician una conversación que demuestra interés o realizan una compra. Si un contacto no responde ni realiza pedidos durante tres o cuatro semanas, puede retirarse de la lista o recibir comunicaciones con menor frecuencia para evitar ser molesto. No se asume una lista de difusión masiva.
5. La campaña se evalúa por zona mediante tarjetas entregadas, conversaciones iniciadas, contactos etiquetados para seguimiento, pedidos, margen de primera compra y recompra. No se registran datos personales en la medición de campaña.

## Flujo de actualización de precios

1. El responsable recibe una lista de precios nueva del proveedor.
2. La compara con la anterior e identifica variaciones de costo.
3. Aplica la estrategia de margen (`Strat`) de cada producto.
4. Define o ajusta precios B2C.
5. Define precios B2B por separado, por lo general con un margen menor.
6. Carga promociones porcentuales cuando corresponda.
7. La web consume o publica los datos actualizados desde las planillas.

## Flujo de promoción

1. El responsable define una promoción estándar.
2. La carga como porcentaje en la hoja de precios.
3. La promoción se mantiene activa hasta que el responsable la modifique o elimine.

## Flujo de cancelación

1. Un pedido puede estar considerado por el panel antes de concretarse.
2. Si se cancela, debe dejar de aportar a sus conteos.
3. El control financiero definitivo se realiza contra los cobros registrados en Finanzas.

## Flujo B2B — objetivo en preparación

1. Un comercio pequeño accede a la propuesta B2B.
2. Consulta catálogo y precios B2B separados de B2C.
3. Solicita productos mediante un canal aún por definir.
4. El equipo define condiciones de pago, frecuencia y entrega según la política B2B futura.
5. La operación se registra por separado de B2C.
