## 1. Orden editorial testeable

- [x] 1.1 Crear pruebas Node para el orden editorial con lista exacta, prioridad independiente B2C/B2B, referencias inválidas y fallback alfabético; verificar primero que fallen contra la implementación actual con `node --test tests/editorial-catalog-ordering.test.js`.
- [x] 1.2 Incorporar una configuración editorial aislada en `shared/app.js`, indexada por canal, categoría/subcategoría e `Id_Grupo`, con Pringles (`252`) como prioridad inicial de Snacks Salados para B2C y B2B; verificar que las pruebas nuevas pasen.
- [x] 1.3 Implementar y reutilizar un comparador puro que aplique el prefijo editorial exacto y preserve nombre → marca para el resto; verificar cobertura de los escenarios de la spec y la suite focalizada en verde.

## 2. Integración del catálogo

- [x] 2.1 Aplicar el comparador editorial sólo a la exploración normal por categoría/subcategoría antes de renderizar rieles y grillas; verificar que la misma prioridad resulte en ambos breakpoints y que una subcategoría sin configuración siga alfabética.
- [x] 2.2 Preservar los recorridos de búsqueda global, Nuevos, Descuentos y Nuevos ingresos sin ordenar por prioridad editorial; verificar esos casos con las pruebas focalizadas o aserciones de regresión equivalentes.

## 3. Verificación

- [x] 3.1 Ejecutar `node --test tests/*.test.js` y confirmar que toda la suite existente y las pruebas de orden editorial pasen.
- [x] 3.2 Verificar manualmente en B2C y B2B, desktop y mobile: Pringles primero en Snacks Salados, un grupo no priorizado después del prefijo, una sección sin configuración alfabética y búsqueda/Nuevos/Descuentos sin cambios; registrar resultados y cualquier limitación de publicación.
