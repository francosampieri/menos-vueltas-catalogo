## Why

El orden alfabético actual deja productos de alta prioridad comercial fuera de la primera vista de los rieles mobile y de la grilla desktop. El negocio necesita decidir explícitamente qué grupos aparecen primero por canal y subcategoría, sin convertir esa decisión de exhibición en un cambio de precios, catálogo comercial o estructura de Sheets.

## What Changes

- Incorporar una configuración editorial versionada y separada del catálogo comercial, con prioridades exactas por canal y subcategoría.
- Ordenar primero los grupos configurados según esa lista; mantener el orden alfabético actual para todos los grupos no configurados.
- Aplicar el mismo resultado en los rieles mobile y las grillas desktop de navegación por categoría o subcategoría.
- Inicializar la configuración de `Snacks y Golosinas / Snacks Salados` con el grupo Pringles como primera prioridad en B2C y B2B.
- Mantener sin cambios Google Sheets, Apps Script, el JSON generado, precios, promociones, disponibilidad y la lógica de las vistas de búsqueda, Nuevos y Descuentos.

## Capabilities

### New Capabilities

- `editorial-catalog-ordering`: Configuración y aplicación de un orden de exhibición exacto, independiente por canal y subcategoría, para el catálogo público.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta el motor compartido de catálogo público en `shared/app.js` y una nueva configuración editorial publicada junto a él.
- Afecta B2C y B2B únicamente en la presentación de las categorías y subcategorías configuradas.
- No agrega dependencias, no modifica integraciones, ni cambia contratos de datos o la fuente de verdad en Sheets.
