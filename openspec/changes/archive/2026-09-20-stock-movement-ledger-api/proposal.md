## Why

El contrato de C-01 ya separa proveedor habitual, disponibilidad pública y saldo físico, pero la operación todavía no tiene un libro mayor inmutable ni acciones administrativas de Apps Script para consultarlo y registrar movimientos. C-02 materializa esa base antes de construir la interfaz de inventario o automatizar ventas al entregar, manteniendo el modelo actual de Sheets + Apps Script y sin convertirlo en una promesa de seguridad fuerte o stock en tiempo real.

## What Changes

- Crear en la planilla operativa la hoja `Movimientos_Stock` y su contrato de encabezados, sin reordenar ni completar registros históricos de hojas existentes.
- Incorporar en Apps Script lectura/escritura privada de `Proveedores` y validación de la futura FK `Productos.Id_Proveedor` contra proveedores existentes y activos; `Productos` continúa en la planilla de catálogo.
- Abrir la planilla de catálogo exclusivamente mediante la Script Property `CATALOG_SPREADSHEET_ID`; su valor no se versiona, no se registra en logs y no se publica en JSON.
- Materializar en `Productos`, de forma compatible y sin backfill, los campos privados `Id_Proveedor` y `Modalidad_Abastecimiento`, y el campo público permitido `Sin_Stock`, sólo después de preservar los códigos legacy según C-01.
- Añadir acciones administrativas para crear y actualizar proveedores con PK inmutable, obtener el resumen de saldos y registrar movimientos manuales válidos, usando el nivel de protección actual del admin sin rediseñar autenticación, permisos ni seguridad.
- Calcular cada saldo como suma algebraica de movimientos inmutables y aplicar `LockService`, identificadores de movimiento, signos por tipo, costo de ingreso no negativo, nota y antecedente válido del mismo producto obligatorios para correcciones, unicidad de claves idempotentes y fallo cerrado ante cualquier fila malformada del ledger.
- Reservar `VENTA` para el flujo automático que C-03 conectará a la transición a `Entregado`; C-02 prepara y valida la escritura idempotente con clave exacta `VENTA:<Id_Pedido>:<Item_Id>`, pero no modifica pedidos ni crea ventas automáticas.
- **BREAKING**: retirar de `shared/catalogo.json` los costos y claves/códigos de proveedor que hoy llegan por el volcado CSV, e impedir que `Proveedores`, teléfonos, direcciones, notas, movimientos, `Productos.Id_Proveedor` o modalidad se expongan en B2C/B2B; `Sin_Stock` es la única señal de este dominio autorizada para una publicación futura en C-06.
- No realizar backfill de pedidos, ítems ni movimientos históricos y no implementar reservas, stock en tiempo real, alertas de reposición, lotes, vencimientos, pagos a proveedores, liquidaciones de consignación ni `Proveedor_Efectivo`.
- Añadir pruebas ejecutables y casos de validación para saldos mixtos, correcciones negativas, productos sin stock gestionado, payloads inválidos, privacidad, límites de `LockService` e idempotencia. Esta cobertura automatizada demuestra serialización e invariantes en stubs, pero no afirma concurrencia productiva real; la prueba con escrituras reales se difiere al piloto integrado C-07.

## Capabilities

### New Capabilities

- `stock-movement-ledger-api`: Materialización privada de proveedores y metadatos de abastecimiento, libro mayor inmutable, saldo derivado y acciones administrativas de Apps Script con validación, idempotencia y límites explícitos de exposición.

### Modified Capabilities

- Ninguna. C-02 implementa el contrato canónico `supply-and-inventory-data-contract` sin cambiar sus requisitos.

## Impact

- `apps-script/Code.gs`: nuevos encabezados, acceso a la planilla de catálogo, validadores, cálculo de saldo y acciones administrativas para proveedores y movimientos.
- `.github/workflows/actualizar-catalogo.yml`: listas blancas explícitas para retirar costos y claves/códigos de proveedor de `shared/catalogo.json` e impedir que campos privados nuevos lleguen a superficies públicas. `admin/productos.json` conserva el costo que ya usa el panel, pero no incorpora contactos, notas, registros de proveedores ni movimientos.
- Planilla operativa: nueva hoja `Movimientos_Stock`; la hoja `Proveedores` existente conserva sus IDs aprobados y se valida sin inventar datos.
- Planilla de catálogo: materialización controlada y sin backfill de la FK y metadatos aprobados en `Productos`, preservando previamente los códigos legacy conforme a C-01.
- API: nuevas acciones orientadas al admin sobre el deployment actual de Apps Script. No se añade backend, framework, dependencia, build ni una garantía nueva de autenticación o confidencialidad.
- Deployment: el deployment existente quedó actualizado en el lugar a la versión 16, preservando su URL y sin crear otro deployment. Las versiones 15 y 14 permanecen disponibles para rollback. La verificación productiva de C-02 fue exclusivamente de lectura: `listarProveedores` devolvió 3 registros y `resumenStock` 468 productos; no se realizaron escrituras sintéticas productivas.
- Sin cambios de interfaz en `admin/`, `b2c/` o `b2b/`; C-04 consumirá estas capacidades administrativas y C-03 conectará la venta automática a `Entregado`.
