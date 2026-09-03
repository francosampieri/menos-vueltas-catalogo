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

## Pedido, pago y entrega

1. El carrito web no es una confirmación final: deriva el pedido a WhatsApp.
2. Por WhatsApp se solicita o confirma dirección y se acuerda el día y horario de entrega.
3. La compra al proveedor se realiza contra pedido; no existe stock propio como regla general.
4. Los pedidos se agrupan y se retiran de la distribuidora el día previo o el mismo día de entrega, normalmente en una visita semanal.
5. El cobro ocurre al entregar el pedido, en efectivo o transferencia.
6. Actualmente no se emiten facturas.
7. El resultado financiero más confiable son los cobros registrados en Finanzas, no sólo el conteo del panel.
8. Un pedido contabilizado por el panel deja de aportar si luego se cancela.
9. Para B2C, dentro de la cobertura vigente, el envío cuesta $1.500 por pedido sin importar la zona. Es gratis cuando el neto de productos, luego de promociones y descuentos por cantidad, es igual o superior a $35.000. El cálculo no incluye envío ni extras.
10. La cobertura se confirma por WhatsApp; esta regla no extiende las zonas atendidas. El viaje a la distribuidora tiene costo operativo aunque la entrega local sea cercana.
11. B2B no tiene aún política de envío, por lo que no debe heredar ni mostrar la regla B2C.
12. En un pedido B2C, el total es productos netos + envío + extras. El envío se conserva como dato histórico independiente y la ganancia expuesta por el panel es previa al costo logístico.

## Cobertura y datos personales

1. La cobertura se limita a Carrodilla, partes de Luján de Cuyo y partes de Chacras de Coria; como guía, entregas a menos de ocho a diez minutos.
2. La expansión debe priorizar densidad dentro de pocos barrios antes que cobertura amplia.
3. Los datos mínimos de cliente son teléfono y dirección. Los agentes y la documentación no deben copiar, publicar ni inventariar datos personales concretos.
