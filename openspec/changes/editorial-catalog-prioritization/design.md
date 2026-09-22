## Context

El motor compartido en `shared/app.js` agrupa los productos por categoría/subcategoría y ordena cada grupo de tarjetas por nombre y marca antes de renderizar. Ese resultado alimenta los rieles de exploración mobile y las grillas desktop de B2C y B2B. Ver `proposal.md` y la especificación `editorial-catalog-ordering` para el comportamiento requerido.

## Goals / Non-Goals

**Goals:**

- Añadir una capa editorial pequeña, visible y modificable en código, sin modificar la fuente comercial de verdad.
- Mantener un único comparador de orden para las vistas de exploración B2C y B2B.
- Permitir una lista exacta de grupos al inicio de cada subcategoría, seguida por el orden alfabético existente.

**Non-Goals:**

- No administrar prioridades desde Sheets, Apps Script, precios, ventas, márgenes, promociones ni una fuente externa.
- No añadir badges, secciones duplicadas, ranking automático, personalización ni cambios de layout.
- No cambiar los criterios de búsqueda, Nuevos, Descuentos o Nuevos ingresos.

## Decisions

### Configuración editorial local y separada por canal

La configuración se declarará en una sección editorial claramente aislada del resto de la lógica de catálogo, indexada como `canal → categoría/subcategoría → Id_Grupo[]`. Usará `Id_Grupo` porque la tarjeta representa un grupo con posibles variantes y ese identificador permanece estable frente a cambios de nombre, marca, tamaño o sabor.

La configuración inicial contendrá únicamente el grupo `252` (Pringles) para `Snacks y Golosinas / Snacks Salados` en B2C y B2B. Las futuras altas y reordenamientos se harán editando esa configuración y publicando el sitio.

Se eligió configuración local en vez de campos de Sheets para mantener este primer cambio reversible y no alterar el contrato público, la allowlist ni la estructura de la fuente de verdad comercial. Se descartó inferir prioridad por marca, venta, margen o promoción porque esas reglas no están confirmadas y mezclarían la exhibición con decisiones comerciales.

### Comparador compuesto reutilizable

El motor resolverá primero la lista aplicable al canal y a la sección actual. Para cada grupo elegible, calculará su posición editorial; los grupos presentes se ordenarán por esa posición y los restantes conservarán el comparador actual nombre → marca. Referencias repetidas, inexistentes o no disponibles para el canal se ignorarán de forma segura.

El comparador sólo se utilizará en navegación normal de categoría o subcategoría. Búsqueda y filtros especiales conservarán su orden actual antes de llegar al comparador editorial.

### Consistencia de superficies sin cambio visual

La misma colección ya ordenada alimentará el riel mobile y la grilla desktop; no se crearán dos listas ni una interfaz nueva. La prioridad no se señalará con badge ni texto, para no interpretar "priorizado" como promoción, disponibilidad o recomendación automática.

## Risks / Trade-offs

- [La prioridad cambia con cierta frecuencia] → cada ajuste requiere edición y publicación; si se vuelve una tarea operativa recurrente, se podrá proponer una futura migración a campos editoriales de Sheets.
- [Una subcategoría cambia de nombre] → su clave editorial deja de coincidir y la sección vuelve al orden alfabético; se documentará la clave junto a la configuración y se verificará en la revisión manual.
- [Un grupo configurado deja de estar habilitado en un canal] → la referencia se ignora y el catálogo mantiene los demás grupos ordenados, sin estados vacíos.
- [Se agregan demasiados grupos priorizados] → pueden volver a ocultarse los últimos en mobile; la pauta operativa será usar una lista breve y revisarla por subcategoría.

## Migration Plan

1. Añadir la configuración inicial y el comparador compuesto sin modificar datos comerciales.
2. Verificar manualmente Snacks Salados y una sección sin configuración en B2C y B2B, en desktop y mobile.
3. Publicar como cambio frontend reversible. Para revertir, se elimina la entrada editorial o se restaura el comparador alfabético; no hay migración de datos ni efecto histórico.
