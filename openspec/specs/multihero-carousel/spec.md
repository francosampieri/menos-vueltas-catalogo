# multihero-carousel Specification

## Purpose
Permite mostrar mensajes de landing independientes en un carrusel estable y coherente, sin sustituir ni limitar el diseño propio de cada hero público.

## Requirements

### Requirement: Landings con heroes ordenados e independientes
Las landings públicas B2C y B2B SHALL presentar una colección ordenada de heroes independientes. Cada hero SHALL conservar su propio bloque de contenido HTML, y la colección SHALL reservar primero un hero actual vacío, seguir con el hero estándar vigente y admitir heroes extra.

#### Scenario: Hero estándar disponible mientras el actual está vacío
- **WHEN** una landing carga sin contenido diseñado para el hero actual
- **THEN** conserva ese espacio como primer hero y permite navegar al hero estándar que ocupa la segunda posición

#### Scenario: Hero extra con composición propia
- **WHEN** se agrega un hero extra a una landing
- **THEN** puede tener contenido y acciones distintos sin modificar el HTML de los otros heroes

### Requirement: Lienzo uniforme del carrusel
Cada hero SHALL ocupar el ancho completo disponible y respetar el mismo lienzo de su dispositivo: 16:7 en escritorio y tablet horizontal, y 9:13 en mobile. Las imágenes de campaña SHALL poder prepararse con guías de 1600 × 700 px para escritorio y 1080 × 1560 px para mobile.

#### Scenario: Cambio entre heroes de escritorio
- **WHEN** la landing muestra heroes consecutivos en una pantalla de escritorio
- **THEN** cada uno ocupa el mismo lienzo 16:7 y el contenido posterior no cambia de posición por una diferencia de altura entre heroes

#### Scenario: Cambio entre heroes de mobile
- **WHEN** la landing muestra heroes consecutivos en una pantalla mobile
- **THEN** cada uno ocupa el mismo lienzo 9:13 y el contenido posterior no cambia de posición por una diferencia de altura entre heroes

### Requirement: Rotación y posición visibles
El carrusel SHALL comenzar por el primer hero, avanzar al siguiente cada ocho segundos y volver al primero después del último. SHALL mostrar puntos de posición en ambos tipos de dispositivo, y el punto activo SHALL llenarse de forma progresiva durante su intervalo.

#### Scenario: Avance automático cíclico
- **WHEN** transcurren ocho segundos sin una pausa aplicable
- **THEN** se muestra el hero siguiente y, después del último hero, se vuelve al primero

#### Scenario: Progreso del hero actual
- **WHEN** un hero está activo durante su intervalo automático
- **THEN** su punto de posición se llena progresivamente hasta el cambio de hero

### Requirement: Navegación adaptada al dispositivo
En escritorio el carrusel SHALL ofrecer flechas anterior y siguiente. En mobile SHALL cambiar de hero mediante un gesto horizontal y no SHALL mostrar flechas. Una navegación manual SHALL reiniciar el intervalo automático desde cero.

#### Scenario: Navegación con flecha en escritorio
- **WHEN** una persona activa una flecha de navegación en escritorio
- **THEN** se muestra el hero adyacente y su intervalo automático comienza de nuevo

#### Scenario: Navegación por gesto en mobile
- **WHEN** una persona realiza un gesto horizontal suficiente sobre el hero en mobile
- **THEN** se muestra el hero adyacente y su intervalo automático comienza de nuevo

### Requirement: Pausas no intrusivas del avance automático
El carrusel SHALL pausar su cuenta durante una interacción, mientras la pestaña no sea visible, cuando el dispositivo solicite reducción de movimiento y mientras una persona mantenga un dedo sobre el hero mobile. El desplazamiento del cursor sobre un hero de escritorio SHALL NOT pausar el carrusel.

#### Scenario: Dedo mantenido en mobile
- **WHEN** una persona mantiene un dedo sobre el hero mobile
- **THEN** el punto activo deja de avanzar hasta que la interacción termina

#### Scenario: Cursor sobre el hero de escritorio
- **WHEN** una persona desplaza el cursor sobre el hero en escritorio sin otra interacción
- **THEN** el carrusel mantiene su cuenta y puede avanzar normalmente

#### Scenario: Preferencia de reducción de movimiento
- **WHEN** el dispositivo indica preferencia por reducir movimiento
- **THEN** el carrusel no avanza automáticamente
