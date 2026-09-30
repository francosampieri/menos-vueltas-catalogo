# Tasks

## 1. Contrato y comportamiento compartido

- [x] 1.1 Escribir pruebas Node fallidas para el ciclo, reinicio manual, pausas y detección de gestos del carrusel; verificar que `node --test tests/multihero.test.js` falle antes del módulo.
- [x] 1.2 Implementar el módulo compartido sin dependencias y exponer el helper testeable; verificar que `node --test tests/multihero.test.js` pase con casos de recorrido, pausas y gestos.

## 2. Integración de landings

- [x] 2.1 Reemplazar el selector de hero B2C por bloques ordenados y el módulo compartido; verificar que la estructura conserve el hero actual vacío y el estándar en segunda posición.
- [x] 2.2 Reemplazar el selector y placeholder promocional B2B por los mismos bloques ordenados; verificar que B2B conserva contenido y acciones propios.
- [x] 2.3 Incorporar estilos compartidos para lienzos 16:7 y 9:13, puntos de progreso, flechas desktop y swipe mobile; verificar selectores y breakpoints mediante pruebas de estructura.

## 3. Verificación

- [x] 3.1 Ejecutar la suite Node completa y `openspec validate multihero --strict`; verificar que todos los tests y la especificación pasen.
- [x] 3.2 Revisar manualmente B2C y B2B en desktop y mobile: ciclo de ocho segundos, punto activo, flechas, swipe, pausas solicitadas y ausencia de pausa por hover desktop.
