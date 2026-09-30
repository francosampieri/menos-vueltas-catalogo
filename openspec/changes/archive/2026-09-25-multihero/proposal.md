# Proposal

## Why

La landing actualmente permite elegir un único hero completo mediante un
interruptor de código. Menos Vueltas necesita comunicar campañas y mensajes
vigentes sin reemplazar ni descartar el hero estándar, manteniendo la libertad
de diseñar cada hero de forma independiente.

## What Changes

- Reemplazar el selector excluyente de hero estándar o promocional por un
  carrusel compartido entre B2C y B2B.
- Mantener cada hero como un bloque HTML autónomo: un `hero-actual` primero,
  vacío hasta que se diseñe; el `hero-estandar` segundo; y bloques extra
  opcionales.
- Avanzar automáticamente en ciclo cada ocho segundos y mostrar puntos de
  posición, con el punto activo llenándose durante su intervalo.
- Permitir cambio manual por flechas en escritorio y por gesto horizontal en
  mobile, reiniciando el intervalo tras una navegación manual.
- Pausar el avance durante una interacción, cuando la pestaña no está visible,
  cuando el dispositivo solicita menos movimiento y mientras se mantiene un
  dedo sobre el hero mobile. El hover de escritorio no pausará el avance.
- Retirar la modalidad anterior de hero promocional controlada por
  `data-hero`.

## Capabilities

### New Capabilities

- `multihero-carousel`: presenta y navega bloques de hero independientes en
  las landings públicas B2C y B2B.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta `b2c/index.html`, `b2b/index.html`, `shared/styles.css` y un nuevo
  script compartido de interfaz.
- No modifica Google Sheets, Apps Script, catálogo, precios, promociones ni
  datos personales.
- No agrega dependencias ni frameworks.
