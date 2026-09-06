# Reglas de negocio

## Fuente de verdad y datos

1. Google Sheets es la fuente de verdad para los datos operativos y comerciales.
2. Un cambio en Sheets debe prevalecer frente a una representación antigua en la web, el panel u otra capa.
3. Los cambios de catálogo y precios los realiza manualmente el responsable del negocio.
4. Los datos de B2C y B2B deben mantenerse separados.

## Precios y márgenes

1. Cada producto tiene un costo y una estrategia de margen predefinida identificada en la hoja de precios como `Strat`.
2. Al cargar una lista nueva del proveedor, se compara con la anterior y se actualizan las diferencias de precio.
3. El precio B2C se calcula a partir del costo y de la estrategia de margen del producto.
4. El precio B2B no equivale al “precio mayorista”; se define por separado y suele utilizar un margen menor que B2C.
5. El precio mayorista es un descuento por cantidad de unidades del mismo producto y puede existir dentro de B2C.
6. Los productos ancla deben mantener márgenes relativamente bajos, aproximadamente de 15% a 20%, para impulsar la compra.
7. La rentabilidad esperada se concentra en categorías rentables: productos de merienda, galletas, limpieza y hogar.
8. Las promociones estándar son porcentuales y se cargan en la hoja de precios.
9. Las promociones no requieren fecha límite obligatoria: su inicio y finalización se definen manualmente.
10. Ante un cambio de precio del proveedor, se respeta al cliente el precio B2C confirmado al realizar su pedido.
11. Los precios comunicados y calculados en B2C, incluidos los de promociones temporales, por cantidad y códigos, son múltiplos de $50. Se redondean al múltiplo más cercano y, en empate, hacia abajo. B2B no adopta esta regla.

## Códigos promocionales B2C

1. Los códigos promocionales aplican sólo a B2C; no modifican precios, flujos ni pedidos B2B.
2. Cada código se administra en `Codigos_Promo` de Google Sheets con código, canal, porcentaje, estado y vigencia. Sólo se admiten descuentos porcentuales.
3. Se permite un único código por pedido. No existen descuentos fijos ni códigos para envío.
4. El descuento se calcula sobre los productos sin promoción temporal. Los productos con precio por cantidad siguen siendo elegibles y el porcentaje se aplica sobre ese precio efectivo.
5. Cada subtotal elegible se descuenta por porcentaje y su precio final se redondea al múltiplo de $50 más cercano, con empate hacia abajo. El descuento por código es la suma de las diferencias de esas líneas y se conserva separado del descuento propio de los productos.
6. El envío se calcula nuevamente sobre el neto de productos posterior al descuento por código.
7. La web valida que el código esté activo, sea B2C y esté dentro de su vigencia. Si no puede validarlo, no aplica descuento.
8. En esta etapa, el beneficio de primera compra se confirma manualmente durante la atención por WhatsApp. El equipo puede retirar el código si no corresponde y el pedido se recalcula. A futuro, una automatización podrá considerarlo consumido sólo al entregar el pedido.
9. Al guardar el pedido, el código, porcentaje y descuento quedan congelados como historial; cambios posteriores de la campaña no alteran pedidos existentes.

## Pedido, pago y entrega

1. El carrito web no es una confirmación final: deriva el pedido a WhatsApp.
2. Por WhatsApp se solicita o confirma dirección y se acuerda el día y horario de entrega.
3. La compra al proveedor se realiza contra pedido; no existe stock propio como regla general.
4. Los pedidos B2C se entregan actualmente los viernes. Se aceptan pedidos todos los días y se recomienda realizarlos entre martes y miércoles; los ingresados hasta el jueves a las 16 h pueden incluirse en la entrega de ese viernes. Los posteriores al corte del jueves pueden incluirse sólo si es viable; los pedidos ingresados el viernes pasan a la semana siguiente y se informa al cliente.
5. Los pedidos se agrupan y se retiran de la distribuidora el día previo o el mismo día de entrega, normalmente en una visita semanal.
6. El cobro ocurre al entregar el pedido, en efectivo o transferencia.
7. Actualmente no se emiten facturas.
8. El resultado financiero más confiable son los cobros registrados en Finanzas, no sólo el conteo del panel.
9. Un pedido contabilizado por el panel deja de aportar si luego se cancela.
10. Para B2C, dentro de la cobertura vigente, el envío cuesta $1.500 por pedido sin importar la zona. Es gratis cuando el neto de productos, luego de promociones y descuentos por cantidad, es igual o superior a $35.000. El cálculo no incluye envío ni extras.
11. La cobertura se confirma por WhatsApp; esta regla no extiende las zonas atendidas. El viaje a la distribuidora tiene costo operativo aunque la entrega local sea cercana.
12. B2B no tiene aún política de envío, por lo que no debe heredar ni mostrar la regla B2C.
13. En un pedido B2C, el total es productos netos + envío + extras. El envío se conserva como dato histórico independiente y la ganancia expuesta por el panel es previa al costo logístico.
14. Si una falta o sustitución se detecta con tiempo antes del retiro, se consulta al cliente por WhatsApp. Si se detecta al retirar el pedido y no hay tiempo de consultar, el equipo puede elegir una alternativa razonablemente equivalente; al entregar debe explicar el cambio y el cliente puede rechazarla, en cuyo caso se elimina ese producto del pedido.
15. Si no existe una alternativa clara, se elimina el producto faltante y se informa la situación al cliente. Las pequeñas diferencias de precio pueden absorberse para evitar perjuicio al cliente; no es una regla automática para todos los casos.

## Cobertura y datos personales

1. La cobertura se limita a Carrodilla, partes de Luján de Cuyo y partes de Chacras de Coria; como guía, entregas a menos de ocho a diez minutos.
2. La expansión debe priorizar densidad dentro de pocos barrios antes que cobertura amplia.
3. Los datos mínimos de cliente son teléfono y dirección. Los agentes y la documentación no deben copiar, publicar ni inventariar datos personales concretos.
