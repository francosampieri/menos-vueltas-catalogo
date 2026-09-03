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
- WhatsApp es el canal de cierre y coordinación.
- La política de envío B2C vigente es $1.500 fijo dentro de la cobertura actual y gratis desde $35.000 netos de productos, después de promociones y descuentos por cantidad. B2B no adopta esta política.
- `Envio` es un campo monetario histórico propio del pedido: `1500` cobrado, `0` bonificado y vacío si el pedido histórico no lo registraba. El total incluye envío y extras; la ganancia visible es antes del costo logístico.
- El Apps Script debe leer y escribir `Envio` por encabezado y no se hará backfill de pedidos anteriores.
- El modelo actual es compra contra pedido y retiro en distribuidora, no stock propio en tiempo real.
- La prioridad técnica es velocidad y bajo costo.
- Entender el código e incorporar funcionalidades tiene prioridad sobre eliminar código muerto.
- Una futura reescritura con buenas prácticas es deseable, pero no inmediata.

## Supuestos a validar antes de automatizar

- Los datos publicados desde Sheets son suficientes y consistentes para alimentar las vistas web.
- Los estados actuales del panel representan adecuadamente el flujo operativo.
- La frecuencia de un retiro semanal seguirá siendo viable mientras crezca la base de clientes.
- Faltantes, sustituciones y cantidades no disponibles se resolverán por WhatsApp hasta una política explícita.
- La exposición pública actual de ciertos datos de catálogo/costos es conocida y aceptada por el responsable, pero no debe interpretarse como recomendación de seguridad.

## Límites para agentes

- No redistribuir datos personales encontrados en Sheets.
- No cambiar precios, costos, márgenes, promociones, estados ni políticas de envío sin indicación explícita.
- No mezclar funcionalidades, métricas ni bases de clientes B2C y B2B.
- No asumir stock en tiempo real ni que una venta del panel equivale a cobro real.
- No iniciar una reescritura total como parte de una mejora puntual sin autorización explícita.
