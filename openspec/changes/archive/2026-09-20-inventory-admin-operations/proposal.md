## Why

C-01 y C-02 ya definieron y habilitaron de forma privada la clasificación de abastecimiento, proveedores y el libro mayor de stock, pero el equipo todavía no puede operarlos desde el panel. Se necesita una interfaz administrativa mínima y auditable para gestionar proveedores, clasificar productos y registrar movimientos físicos, sin convertir el catálogo público ni los pedidos en un sistema de stock en tiempo real.

## What Changes

- Incorporar al panel administrativo privado la gestión de proveedores: listado, alta, edición y baja lógica mediante `Activo`; no habrá borrado físico ni cambio de `Id_Proveedor`.
- Permitir clasificar cada producto desde admin con su proveedor habitual, `Modalidad_Abastecimiento` (`CONTRA_PEDIDO`, `CONSIGNACION` o `STOCK_PROPIO`) y `Sin_Stock`, validando la FK y el estado activo del proveedor.
- Incorporar una vista de inventario que muestre por producto el saldo derivado exclusivamente del libro mayor, proveedor habitual, modalidad, condición de gestión y `Sin_Stock`; saldo cero o negativo no cambiará por sí mismo la disponibilidad.
- Incorporar formularios para `INGRESO`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION`, respetando las validaciones, inmutabilidad e idempotencia del libro mayor. `VENTA` no será una operación manual: sólo la podrá generar C-03 al producirse la transición a `Entregado`.
- Mostrar un historial privado de movimientos con trazabilidad operativa, incluida la referencia de pedido cuando exista, sin unir ni mostrar nombre, teléfono, dirección u otros datos personales de clientes.
- Preservar la separación B2C/B2B en las superficies administrativas que muestran canal; no publicar proveedores, costos, modalidad ni movimientos en el catálogo ni en los sitios públicos.
- Excluir alertas, reposición automática, reservas, lotes, vencimientos, pagos o liquidaciones de consignación.

## Capabilities

### New Capabilities

- `inventory-admin-operations`: operación privada de proveedores, clasificación de abastecimiento, consulta de saldos, registro manual e historial seguro de movimientos desde el panel administrativo.

### Modified Capabilities

- Ninguna.

## Impact

- Afectará en un apply posterior el panel estático `admin/` y, sólo si hace falta para el historial de lectura, las acciones privadas de Google Apps Script y la hoja operativa ya definida por C-02.
- Reutilizará las acciones privadas de C-02 para proveedores, clasificación, resumen y alta de movimientos; no cambiará sus reglas de validación ni habilitará `VENTA` manual.
- No modifica en esta propuesta código, Google Sheets, Apps Script, catálogo publicado, B2C, B2B, despliegues, precios, Finanzas ni knowledge-base.
- El acceso actual del admin sigue teniendo seguridad básica conocida: los campos opcionales de contacto de proveedores permanecen privados y no se incluirán en el historial de inventario ni en ninguna superficie pública.
