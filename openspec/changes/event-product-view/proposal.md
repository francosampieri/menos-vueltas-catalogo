# Proposal

## Why

Una campaña necesita reunir productos B2C concretos desde un CTA del hero sin convertir esa selección editorial en un filtro, ruta o sección permanente del catálogo. La persona debe poder explorarla y consultar detalles sin perder el contexto de la campaña.

## What Changes

- Incorporar una `vista-evento` B2C temporal, activable solamente mediante un CTA de un hero asociado.
- Configurar cada evento con estado activo, textos, CTA y una lista explícita y ordenada de `Id_Grupo`.
- Renderizar una variante de tarjeta propia para la vista, usando los datos, precios, badges y modal existentes sin reutilizar nodos ni IDs del catálogo normal.
- Integrar la vista y el modal con el historial del navegador para que cerrar, Escape y Atrás restauren correctamente la landing o la vista evento y su foco.
- Dejar la primera definición de campaña inactiva hasta que existan los `Id_Grupo` B2C confirmados; no se agregan productos, precios ni atributos inventados.

## Capabilities

### New Capabilities

- `event-product-view`: Vista editorial temporal B2C, accesible exclusivamente desde heroes configurados y aislada de la navegación y catálogo normal.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta exclusivamente `b2c/index.html`, `shared/app.js`, `shared/styles.css` y pruebas frontend.
- No modifica B2B, Sheets, Apps Script, URLs de datos, JSON generado, precios ni promociones.
