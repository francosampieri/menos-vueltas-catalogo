# Tasks

## 1. Contrato y pruebas

- [x] 1.1 Escribir pruebas Node inicialmente fallidas para validar la elegibilidad, orden explícito y desactivación de una configuración de vista evento B2C.
- [x] 1.2 Extender las pruebas con la estructura B2C, aislamiento de B2B, tarjetas con IDs propios y estado de historial de evento; verificar que fallen antes de implementar.

## 2. Implementación B2C

- [x] 2.1 Declarar en la landing B2C el registro inactivo y el contenedor estructural de vista evento; verificar que no agrega CTA, menú, filtro ni ruta mientras no existan IDs confirmados.
- [x] 2.2 Implementar en `shared/app.js` el registro, selección explícita de grupos y renderer de tarjetas propias que reutilicen datos B2C y `abrirModalProducto(...)`; verificar que las pruebas de comportamiento pasen.
- [x] 2.3 Integrar navegación, cierre, Escape, foco e historial interno de la vista evento y del modal; verificar mediante pruebas estructurales.
- [x] 2.4 Agregar estilos estructurales responsive sin definir el diseño editorial final; verificar que no cambien B2B ni la navegación del catálogo.

## 3. Verificación

- [x] 3.1 Ejecutar `node --test` y `openspec validate event-product-view --strict`; verificar suite verde y especificación válida.
- [ ] 3.2 Revisar manualmente en B2C desktop y mobile el acceso hero configurado, modal, cierre, Escape y Atrás; comprobar además ausencia desde navegación normal, catálogo, Nuevos, carrito y B2B sin regresiones.
