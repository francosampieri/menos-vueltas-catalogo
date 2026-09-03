# Modelo de datos

## Principio de autoridad

Google Sheets es la fuente de verdad para datos comerciales y operativos. El código consume publicaciones CSV de catálogo y se comunica con un Google Apps Script para leer y escribir la operación de pedidos.

Los JSON versionados en el repositorio no son la fuente de edición: son artefactos generados para publicar el catálogo y alimentar el panel.

## Catálogo

La automatización genera `shared/catalogo.json` a partir de tres pestañas publicadas por CSV:

| Entidad | Uso | Identificador o relación |
|---|---|---|
| Productos | Datos base y habilitación por canal | `Id`; relación con grupos mediante `Id_Grupo` |
| Grupos | Clasificación del catálogo | `Id_Grupo` |
| Precios B2C | Precio y condiciones B2C | `Id` de producto |
| Precios B2B | Precio y condiciones B2B | `Id` de producto |

Las tablas B2C y B2B comparten la hoja Precios y están separadas por una columna vacía. La automatización detecta ese separador por encabezado, no por posición fija.

Campos comerciales confirmados:

| Campo | Significado |
|---|---|
| `Precio_Costo` | Costo unitario de referencia |
| `Precio_Venta` | Precio de lista por unidad |
| `Uni Dto` | Cantidad mínima para descuento por unidades |
| `Precio_Mayorista` | Precio unitario al alcanzar esa cantidad |
| `promo` | Porcentaje de promoción temporal |
| `Precio_Promo` | Precio unitario con promoción |
| `Precio_Promo_Mayorista` | Precio por cantidad con promoción |

Para publicarse, un producto debe estar `Activo` y habilitado con `Cat B2C` o `Cat B2B`. El panel consume `admin/productos.json`, una versión reducida con los campos necesarios para búsqueda y cálculos.

### Señales de presentación del catálogo público

`Nuevo` no tiene hoy una columna ni una regla derivada en Sheets o en el JSON generado. La web lo determina mediante una lista manual de IDs de variantes en `shared/app.js`; un grupo se considera nuevo si alguna de sus variantes figura en esa lista. Esta marca es solo de presentación y no modifica datos comerciales.

El filtro público `Descuentos` evalúa, por variante, una rebaja real: `Precio_Promo < Precio_Venta`. Los precios ya llegan resueltos para el canal de la página, por lo que B2C y B2B aplican el mismo criterio sobre sus respectivos precios y no se mezclan. El descuento por cantidad no basta por sí solo para incluir un producto en este filtro.

## Pedidos

La hoja `Pedidos` usa estos encabezados:

```text
Id, Canal, Fecha_Pedido, Fecha_Entrega, Cliente_Id, Cliente, Telefono,
Direccion, Barrio, Estado, Medio_Pago, Subtotal, Descuento, Envio, Extras,
Desc_Extras, Total, Costo, Ganancia, Notas, Actualizado
```

`Envio` es un campo monetario propio, ubicado entre `Descuento` y `Extras`. En
pedidos B2C nuevos vale `1500` cuando se cobra envío y `0` cuando se bonifica;
vacío preserva que un pedido histórico no registraba esta información. `Extras`
y `Desc_Extras` son conceptos independientes y no deben reutilizarse para
envío. El total del pedido es productos netos + `Envio` + `Extras`. La
ganancia que muestra el panel incluye el ingreso de envío y se interpreta como
ganancia antes del costo logístico.

Estados presentes en el panel:

```text
Nuevo → Pedido a Distribuidora → Para entregar → Entregado
```

`Cancelado` es un estado alternativo y no se incluye en los indicadores de facturado ni ganancia del panel. Los valores monetarios se guardan para preservar el histórico frente a cambios posteriores de catálogo.

## Ítems

La hoja `Items` usa estos encabezados:

```text
Id_Pedido, Canal, Fecha_Pedido, Id_Producto, Producto, Cantidad,
Precio_Lista, Precio_Unitario, Costo_Unitario, Cant_Min, Precio_Cantidad,
Subtotal, Descuento, Total, Costo, Ganancia, Precio_Promo,
Precio_Promo_Cantidad, Porcentaje_Promo
```

Al incorporar un producto a un pedido se congelan precios, costo, mínimo de cantidad y reglas de promoción. Así, un pedido histórico conserva sus valores aun cuando cambie el catálogo. El Apps Script mantiene compatibilidad con pedidos previos que no contengan los tres campos finales de promoción.

## Clientes, contactos y finanzas

`Clientes` contiene:

```text
Id, Canal, Nombre, Telefono, Direccion, Barrio, Mapa, Notas, Actualizado
```

Los pedidos guardan una copia de nombre, teléfono, dirección y barrio para conservar el destino histórico. La lógica del panel filtra los clientes por `Canal`; B2C y B2B deben mantenerse como segmentos separados.

`Contactos` contiene:

```text
Numero, Nombre, Fecha, Origen
```

Se usa para contactos de novedades y difusión. Nunca documentar ni incluir registros reales.

La planilla de Finanzas es separada y manual; es la referencia práctica de transferencias recibidas. Su esquema no fue relevado y no debe inferirse a partir del panel.

## Integridad

El Apps Script usa `LockService` para serializar escrituras. Lee y relaciona pedidos e ítems por `Id_Pedido`, permite guardar y eliminar pedidos y clientes, y guardar contactos. Desde el panel se evita borrar clientes con pedidos vinculados. Debe leer y escribir `Envio` por nombre de encabezado para conservar compatibilidad con pedidos históricos y no requiere completar valores anteriores. El script puede agregar encabezados faltantes de promoción a `Items` sin reordenar las columnas existentes.

No cambiar nombres, orden de columnas ni relaciones sin revisar el Apps Script y el workflow de catálogo.
