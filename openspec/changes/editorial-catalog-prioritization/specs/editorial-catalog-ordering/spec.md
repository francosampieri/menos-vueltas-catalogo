## Purpose

Permitir que el catálogo público priorice grupos elegidos por el negocio sin alterar los datos comerciales ni la navegación alfabética restante.

## ADDED Requirements

### Requirement: Prioridad editorial independiente por canal y subcategoría
El catálogo público MUST admitir una configuración editorial versionada, independiente de los datos comerciales, que asocie cada canal (`B2C` o `B2B`) y combinación de categoría/subcategoría con una lista ordenada de identificadores estables de grupo. La configuración de un canal MUST NOT afectar el orden del otro canal, incluso cuando ambos muestren el mismo grupo.

#### Scenario: Prioridad distinta entre canales
- **WHEN** un grupo tiene una prioridad configurada para una subcategoría de B2C pero no para su equivalente de B2B
- **THEN** el grupo se adelanta sólo en B2C y B2B conserva su orden propio

#### Scenario: Subcategoría sin configuración
- **WHEN** una categoría o subcategoría no tiene una lista editorial configurada para el canal actual
- **THEN** sus grupos conservan el orden alfabético vigente

### Requirement: Prefijo de orden exacto y resto alfabético
Al mostrar una categoría o subcategoría configurada, el catálogo MUST presentar primero los grupos elegibles incluidos en la lista editorial, en el orden exacto de esa lista. Después MUST presentar todos los grupos elegibles no configurados con el orden alfabético vigente por nombre y, ante igualdad, por marca. Una referencia repetida, inexistente o no elegible para el canal MUST NOT impedir el renderizado ni desplazar grupos no configurados.

#### Scenario: Grupo priorizado antes de grupos alfabéticamente anteriores
- **WHEN** la lista editorial de una subcategoría incluye un grupo cuyo nombre sería posterior en el orden alfabético
- **THEN** ese grupo aparece antes de los grupos no configurados de esa subcategoría

#### Scenario: Grupos sin prioridad conservan agrupación alfabética
- **WHEN** se muestran grupos no incluidos en la lista editorial
- **THEN** se ordenan por nombre y, ante el mismo nombre, por marca como en el catálogo actual

#### Scenario: Referencia editorial no disponible en el canal
- **WHEN** una lista editorial referencia un grupo que no tiene productos activos y habilitados para el canal actual
- **THEN** el catálogo omite esa referencia y muestra los demás grupos sin error ni espacio vacío

### Requirement: Orden consistente en exploración mobile y desktop
El orden editorial MUST ser el mismo en los rieles horizontales mobile y en las grillas desktop cuando la persona explora una categoría o subcategoría. La búsqueda global, el filtro Nuevos, el filtro Descuentos y la franja de Nuevos ingresos MUST conservar sus reglas de orden actuales.

#### Scenario: Misma subcategoría en breakpoint mobile y desktop
- **WHEN** una persona abre una subcategoría configurada en mobile y en desktop
- **THEN** encuentra los grupos priorizados en el mismo orden relativo en ambos formatos

#### Scenario: Búsqueda o filtro especial
- **WHEN** una persona usa búsqueda global, Nuevos, Descuentos o la franja de Nuevos ingresos
- **THEN** esas superficies conservan la regla de orden que tenían antes de la prioridad editorial

### Requirement: Prioridad inicial de Snacks Salados
La configuración inicial MUST ubicar el grupo Pringles como primera prioridad de `Snacks y Golosinas / Snacks Salados` en B2C y en B2B, cuando ese grupo esté habilitado en el canal correspondiente. No se deben introducir otras prioridades iniciales sin una decisión editorial explícita del negocio.

#### Scenario: Snacks Salados con Pringles habilitado
- **WHEN** una persona explora `Snacks y Golosinas / Snacks Salados` en B2C o B2B y Pringles está habilitado en ese canal
- **THEN** Pringles aparece como el primer grupo de la sección

### Requirement: Límite de la decisión editorial
La prioridad editorial MUST cambiar únicamente la posición de grupos en el catálogo público. MUST NOT modificar Google Sheets, Apps Script, el JSON generado, precios, promociones, disponibilidad, variantes, información personal ni reglas comerciales de B2C o B2B.

#### Scenario: Catálogo comercial sin cambios
- **WHEN** se publica la prioridad editorial
- **THEN** los datos comerciales y la elegibilidad de cada grupo continúan provenientes del catálogo vigente del canal sin una nueva fuente de datos
