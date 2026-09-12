# Funcionalidades

## B2C — activo

### Catálogo y navegación

- Mostrar catálogo organizado por categorías o grupos.
- Mostrar precios B2C, promociones y condiciones mayoristas por cantidad cuando estén configuradas.
- Actualizar el catálogo desde planillas administradas por el negocio.
- Ofrecer filtros especiales de `Nuevos` y `Descuentos`, además de categorías y subcategorías. `Nuevos` usa la marca manual de variantes definida en el frontend y `Descuentos` muestra variantes con una rebaja real en el precio del canal actual.
- Ordenar visualmente las categorías y subcategorías alfabéticamente, sin depender del orden de inserción del JSON; el orden interno de productos conserva el orden alfabético vigente por nombre y marca.
- Mostrar en la landing una franja de `Nuevos ingresos`: carrusel de hasta cinco productos y una acción para ver todos los nuevos. Al elegir un producto, se abre primero el catálogo con el filtro Nuevos y luego su detalle; la acción general abre ese catálogo filtrado.
- En móvil, B2C y B2B comparten una barra inferior fija con `Inicio`, `Catálogo` y `Tu pedido`: Inicio vuelve al hero, Catálogo abre el catálogo propio del canal y Tu pedido abre el carrito. El indicador activo representa la vista subyacente —Inicio o Catálogo— y no cambia al abrir el carrito. La cabecera conserva el buscador y los accesos a redes.

### Carrito y pedido

- Agregar productos al carrito y preparar el resumen.
- Conservar temporalmente, por pestaña y de forma separada entre B2C y B2B, los productos y cantidades del carrito. Al restaurarlo, consultar el catálogo vigente para recalcular disponibilidad, precios y condiciones; en B2C, revalidar también el código promocional.
- Permitir transferir el carrito mediante QR: el contenido recibido reemplaza el carrito temporal del destino y, si incluye un código B2C, este se revalida antes de aplicarse.
- Derivar o facilitar el envío del pedido a WhatsApp.
- Mantener coordinación humana posterior por WhatsApp: dirección, fecha, horario, faltantes y condiciones operativas.

### Novedades

- Mostrar una invitación a recibir novedades una única vez por sesión, 30 segundos después del primer agregado manual al carrito. No se activa por restaurar el carrito, importar un QR ni navegar por la página, y espera el cierre de un modal de producto si hay uno abierto.
- La invitación no debe bloquear la interacción con el resto de la página; en móvil puede descartarse arrastrándola desde su manija superior.

## Administración — activa

- Gestionar pedidos mediante los estados actuales.
- Registrar y consultar clientes B2C separados de B2B.
- Mantener ítems de pedido y valores aplicados como historial operativo.
- Permitir operar al fundador y a la socia desde cualquier dispositivo.

## Datos e integraciones — activos

- Consumir catálogo, grupos y precios desde Google Sheets.
- Registrar pedidos, ítems, clientes y contactos mediante Google Apps Script y Sheets.
- Registrar movimientos financieros reales en la hoja de Finanzas.

## B2B — en preparación

- Mantener una presencia visible sin tratarla como oferta comercial lanzada.
- Preparar catálogo y precios diferenciados de B2C.
- Mantener una base de clientes separada.
- Diseñar posteriormente reglas de frecuencia, entregas, mínimos de compra y operación comercial para kioscos y almacenes.
- Mantener los filtros y la presentación de Nuevos/Descuentos usando exclusivamente los precios y productos del canal B2B.

## Futuro deseado, no confirmado como funcionalidad actual

- Dashboard de rentabilidad, ticket promedio y análisis por productos, clientes y zonas.
- Organización de rutas.
- Mayor automatización si el volumen lo justifica.
- Nueva arquitectura y reconstrucción de la web con buenas prácticas.
