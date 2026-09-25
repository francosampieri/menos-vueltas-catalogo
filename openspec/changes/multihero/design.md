# Design

## Context

La landing B2C conserva un hero estándar y estilos compartidos que aún contemplan un interruptor `data-hero`. B2B además conserva un placeholder de campaña separado. Ambas landings ya cargan JavaScript y CSS compartidos sin framework ni build. Ver `proposal.md` para la motivación y la especificación `multihero-carousel` para el contrato observable.

## Goals / Non-Goals

**Goals:**

- Compartir el comportamiento de carrusel entre B2C y B2B sin compartir su contenido comercial.
- Mantener los heroes como HTML libre y ordenable dentro de cada landing.
- Fijar un lienzo estable 16:7 desktop/tablet y 9:13 mobile para evitar saltos de layout.
- No modificar catálogo, pedidos, precios, datos ni integraciones.

**Non-Goals:**

- Diseñar una campaña o crear contenido para `hero-actual`.
- Crear un panel de administración de heroes o cargar heroes desde Sheets.
- Alterar la barra superior, el catálogo, el carrito o el flujo de WhatsApp.

## Decisions

### Módulo de interfaz separado y sin dependencias

Un archivo compartido `shared/multihero.js` concentrará el estado de índice, temporizador, pausas, flechas y gesto. B2C y B2B lo cargarán después de sus scripts actuales. Expone un helper puro para pruebas Node y se inicializa en el navegador sólo cuando existe un carrusel.

Alternativa considerada: agregar la lógica a `shared/app.js`. Se descarta para no aumentar el motor de catálogo con una interacción de landing independiente.

### Bloques HTML como fuente editorial

Cada landing contendrá un contenedor de carrusel y artículos ordenados. El primer artículo `hero-actual` queda vacío, el segundo conserva el hero estándar y los siguientes se agregan como bloques completos. El módulo sólo identifica slides; no conoce títulos, imágenes, botones ni reglas comerciales.

Alternativa considerada: una configuración JavaScript de textos, imágenes y CTAs. Se descarta porque restringe diseños de campaña y duplica el HTML.

### Lienzo y transición estables

El contenedor usa ancho completo y una proporción fija de 16:7 desde 701 px, y 9:13 hasta 700 px. Los slides se desplazan horizontalmente dentro de un track sin cambiar la altura de la landing. Las imágenes internas quedan a cargo de cada hero y deberán usar los recursos guía acordados: 1600 × 700 px y 1080 × 1560 px.

### Indicador de puntos con progreso

El indicador se muestra siempre. Los puntos inactivos comunican cantidad y el activo es una cápsula cuyo relleno CSS dura ocho segundos. Al cambiar de slide, el módulo reinicia la animación con el nuevo índice.

Alternativas consideradas: barras segmentadas y contador numérico. Se descartan porque la decisión de diseño seleccionó puntos con progreso.

### Pausas y navegación por contexto

El módulo avanza cada ocho segundos en ciclo. Las flechas existen sólo en escritorio y el gesto horizontal sólo se procesa en mobile. El timer se detiene durante una interacción, visibilidad oculta, reducción de movimiento y presión activa sobre el hero mobile; el hover de escritorio no interviene. Una navegación manual reinicia el intervalo.

La decisión explícita del responsable es no añadir un control visible de pausa/reanudación.

## Risks / Trade-offs

- [Hero actual vacío antes del lanzamiento] → El primer slide se conservará deliberadamente vacío sólo en esta rama hasta que exista el diseño real; no se desplegará a producción en ese estado.
- [Sin control permanente de pausa] → Se respetan las pausas solicitadas y la preferencia de reducción de movimiento; la decisión de no ofrecer dicho control queda explícita para revisión antes de publicar.
- [Gestos que interfieren con botones] → El gesto requiere un desplazamiento horizontal mínimo y no cambia de hero ante un toque breve.

## Migration Plan

1. Reemplazar el HTML y CSS de selector promo/estándar en ambas landings.
2. Cargar el módulo compartido y mantener el hero estándar como segundo slide.
3. Verificar el flujo manual y automático en B2C y B2B, desktop y mobile.
4. Mantener el cambio en `feature/multihero` hasta diseñar el hero actual y aprobar la publicación.

Revertir consiste en retirar el nuevo script y restaurar el bloque hero estándar anterior desde el historial de Git; no hay migración de datos.
