# Spec Delta

## Purpose

Permite que una campaña B2C muestre una selección editorial temporal de productos desde su hero sin alterar ni exponer la navegación normal del catálogo.

## ADDED Requirements

### Requirement: Entrada editorial configurada y temporal
La experiencia B2C SHALL permitir configurar una vista evento con un identificador, estado de activación, textos de presentación, CTA y una lista explícita y ordenada de `Id_Grupo`. Una vista evento SHALL abrirse únicamente desde un CTA de hero asociado a una configuración activa y SHALL dejar de ser accesible cuando se retire o desactive esa configuración. La experiencia SHALL NOT crear una URL, ruta, entrada de menú, sidebar, filtro, buscador ni sección del catálogo normal.

#### Scenario: Hero asociado abre un evento activo
- **WHEN** una persona activa el CTA de un hero asociado a una vista evento B2C habilitada
- **THEN** la landing muestra la vista editorial de esa campaña sin abrir el catálogo normal

#### Scenario: Evento retirado no expone acceso
- **WHEN** una configuración de evento está inactiva, no tiene grupos elegibles o su CTA asociado se retira
- **THEN** la vista no puede abrirse desde la landing ni desde la navegación normal

### Requirement: Selección explícita y segura de grupos
La vista evento SHALL usar únicamente los `Id_Grupo` declarados en su configuración y SHALL preservar su orden. Sólo SHALL mostrar grupos presentes y elegibles en el catálogo B2C actual; SHALL ignorar con seguridad IDs ausentes, duplicados o no publicados. SHALL NOT inferir productos por categoría, subcategoría, tags, condición de nuevo ni señales de inventario.

#### Scenario: Respeta el orden configurado
- **WHEN** la configuración declara varios `Id_Grupo` B2C disponibles
- **THEN** las tarjetas aparecen en ese mismo orden y cada grupo aparece una única vez

#### Scenario: Grupo no disponible en el catálogo
- **WHEN** la configuración incluye un `Id_Grupo` que no está presente o no es elegible en el catálogo B2C
- **THEN** la vista lo omite sin sustituirlo por otro producto ni exponer datos de otro canal

### Requirement: Tarjetas de evento y detalle de producto
La vista evento SHALL renderizar tarjetas propias, con IDs únicos que no colisionen con las tarjetas del catálogo. Las tarjetas SHALL utilizar los datos comerciales B2C vigentes, badges de presentación, disponibilidad y detalle del producto existentes. Al activar una tarjeta, la experiencia SHALL abrir el modal habitual de producto sin navegar al catálogo normal.

#### Scenario: Consulta de detalle desde el evento
- **WHEN** una persona abre una tarjeta de una vista evento
- **THEN** se muestra el modal de producto habitual y la vista evento permanece como contexto subyacente

#### Scenario: Cierre del detalle devuelve al evento
- **WHEN** una persona cierra el modal abierto desde una tarjeta de evento
- **THEN** vuelve a la misma vista evento y el foco retorna a la tarjeta que lo abrió

### Requirement: Navegación e historial coherentes
La vista evento SHALL integrarse con el cierre explícito, Escape y Atrás del navegador sin dejar overlays, scroll bloqueado ni vistas superpuestas. Cerrar o volver atrás desde la vista evento SHALL regresar a la landing; volver atrás desde su detalle SHALL cerrar solamente el modal y restaurar el evento.

#### Scenario: Atrás desde un detalle de evento
- **WHEN** el detalle de producto de una vista evento está abierto y la persona usa Atrás
- **THEN** el modal se cierra y la vista evento permanece abierta

#### Scenario: Escape o cierre del evento
- **WHEN** una persona usa Escape o el control de cierre de la vista evento
- **THEN** la landing vuelve a quedar activa sin estados visuales o de historial rotos
