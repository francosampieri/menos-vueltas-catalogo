# Descripción general

## Qué es Menos Vueltas

Menos Vueltas es un supermercado online local con entrega a domicilio. Su propuesta es simplificar la compra cotidiana: evitar recorridos, filas, traslados y carga de bolsas. El mensaje se apoya en dos ideas complementarias:

- **Compra simple:** menos fricción que realizar la compra presencialmente.
- **Más tiempo para vos:** el beneficio de delegar esa tarea.

El precio no es el eje del posicionamiento, pero debe comunicarse como conveniente y competitivo para no presentar el servicio como caro o exclusivamente premium.

## Público y zona

La operación se concentra en Carrodilla y zonas cercanas de Luján de Cuyo y Chacras de Coria, en un radio práctico de aproximadamente 8 a 10 minutos de viaje.

El cliente ideal incluye hogares de barrios privados y de poder adquisitivo alto que valoran la conveniencia, sin limitar la propuesta a ese segmento. La marca busca también ser accesible a clase media mediante precios razonables y buena atención.

La base actual es pequeña y se compone principalmente de familiares, amigos y referidos. El objetivo inmediato es incorporar clientes ajenos al círculo cercano. A mediano plazo, se busca consolidar más de cinco clientes fijos y activos en dos o tres barrios, priorizando densidad geográfica antes que cobertura dispersa.

## Canales comerciales

### B2C: activo

La web B2C permite explorar el catálogo, filtrar productos, armar un carrito y enviar el pedido a WhatsApp. La venta no termina en la web: allí comienza una conversación para confirmar dirección, fecha y horario de entrega.

### B2B: en preparación

Existe una web B2B con precios distintos a B2C. Está pensada inicialmente para kioscos y almacenes pequeños, pero sus reglas comerciales —mínimos, frecuencia, entrega y modalidad definitiva— todavía deben definirse. No debe tratarse como una operación madura ni asumir políticas no confirmadas.

## Operación actual

1. La persona arma el pedido en la web y lo envía por WhatsApp, o el pedido se toma directamente por ese canal.
2. El equipo confirma dirección y día de entrega.
3. Los pedidos se agrupan para solicitar productos a Distrosec, el proveedor actual.
4. Se realiza aproximadamente una visita semanal a la distribuidora para retirar los productos pedidos.
5. El equipo entrega los pedidos en domicilio.
6. El cobro ocurre al entregar, mediante efectivo o transferencia.
7. No se emiten facturas en la operación actual.
8. Los ingresos efectivamente cobrados se registran manualmente en la planilla de Finanzas.

No hay stock propio garantizado ni disponibilidad en tiempo real: la compra se realiza por encargo. Ante faltantes o cambios, la resolución se coordina con el cliente.

## Precios y rentabilidad

Los precios se administran manualmente en Google Sheets. Al actualizar una lista del proveedor, se comparan valores, se cargan diferencias y se calcula el precio de venta según un margen definido por producto en el criterio `Strat`.

- B2C y B2B tienen precios independientes.
- B2B suele manejar un margen menor que B2C, decidido manualmente; no hay una fórmula fija documentada.
- “Precio mayorista” no equivale a B2B: es el descuento por comprar cierta cantidad de unidades del mismo producto.
- Las promociones estándar son porcentuales, se cargan en la hoja de precios y no dependen necesariamente de fechas de inicio o fin.
- Los productos ancla atraen la compra con márgenes aproximados de 15–20%.
- Categorías como merienda, limpieza y hogar buscan mejorar la ganancia total del pedido.

## Métricas y restricciones

La planilla de Finanzas es la referencia práctica de transferencias ya recibidas. Las métricas de interés actuales son ganancia y ticket promedio; el panel administrativo no reemplaza ese control financiero.

Distrosec es el único proveedor actual. El catálogo depende de sus productos disponibles, aunque se planea incorporar nuevos proveedores. La logística y las rutas todavía no están formalizadas porque el volumen actual es bajo. El costo y la política de envío están en revisión tras el fin de la promoción inicial.
