# Design

## Context

La landing y el catálogo comparten `shared/app.js`; el catálogo normal ya administra filtros, tarjetas, modal de producto, foco, scroll e historial interno. El primer hero B2C está reservado para campañas y actualmente no contiene un CTA. Véase `proposal.md` y la especificación de esta change.

## Goals / Non-Goals

**Goals:**

- Aislar una vista editorial B2C del catálogo, la navegación y B2B.
- Permitir que el hero y su configuración declaren el evento sin cambiar datos publicados.
- Reutilizar el modal y sus reglas comerciales sin duplicar su lógica.

**Non-Goals:**

- Definir el diseño visual o el contenido de la primera campaña.
- Crear una ruta, URL compartible, filtro, búsqueda o entrada de menú.
- Inventar IDs, productos, imágenes, precios o grupos aún no publicados.

## Decisions

### Registro B2C junto al hero

`b2c/index.html` declarará una configuración global pequeña para eventos y los CTAs de héroes la referenciarán por identificador. El registro contiene `active`, textos, CTA y `groupIds`; una configuración sin IDs confirmados queda inactiva. Esta alternativa mantiene la campaña y su entrada en el mismo documento que el hero, en vez de convertirla en una regla global de catálogo o de Sheets.

### Vista HTML independiente y tarjetas propias

Se añade un contenedor B2C `vista-evento`, paralelo a `vista-landing` y `vista-catalogo`. El renderer crea nodos nuevos con un prefijo de ID de evento y no reutiliza las tarjetas existentes, porque estas contienen IDs y temporizadores asociados al catálogo. La tarjeta de evento comparte datos y las funciones de presentación de producto, pero no se registra en los rieles, filtros ni búsqueda.

### Historial interno sin cambiar URL

El estado de historial existente se amplía con una tercera vista interna, `evento`, conservando `location.href`. El modal existente seguirá creando una capa de producto sobre esa vista. Así Atrás cierra primero el modal y luego retorna a landing, sin convertir el evento en una ruta permanente.

### Estilo estructural neutral

Se agrega sólo la estructura responsive necesaria: cabecera, cierre y grilla de tarjetas. No se fija jerarquía visual, imagen, producto destacado ni identidad de campaña; el diseño final podrá cambiar sin alterar la configuración ni el flujo.

## Risks / Trade-offs

- [Grupos aún no publicados] → La configuración inicial permanece inactiva y el renderer omite IDs ausentes.
- [Duplicación visual de datos] → La vista lee siempre el catálogo B2C ya cargado; no copia precios ni atributos.
- [Historial complejo] → Se centraliza en el estado UI ya existente y se cubre con pruebas de selección, acceso y restauración.

## Migration Plan

1. Publicar la estructura con el evento inicial inactivo.
2. Cuando estén confirmados los `Id_Grupo`, completar su lista, activar el evento y agregar su CTA dentro del hero de campaña.
3. Retirar el CTA o desactivar/eliminar la definición para retirar la vista de acceso.
