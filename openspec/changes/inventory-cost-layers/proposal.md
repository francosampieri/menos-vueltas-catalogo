# Proposal

## Why

El saldo físico actual es auditable desde `Movimientos_Stock`, pero no permite saber qué capital propio permanece inmovilizado, qué mercadería está en consignación ni cuál es el costo histórico de una salida. Se necesita una valorización interna, reproducible desde el ledger append-only, sin convertir el inventario en una fuente de disponibilidad pública ni financiera.

## What Changes

- Incorporar una proyección privada de **tandas internas de costo**: cada `INGRESO` originará siempre una tanda identificable por su `Movimiento_Id`, cantidad y costo unitario reales, incluso si todo su ingreso cubre faltantes previos y su remanente termina en cero. No representa un lote del proveedor y no gestiona vencimientos.
- Extender el contrato privado de `Movimientos_Stock` con la columna `Modalidad_Abastecimiento`: será obligatoria en todo `INGRESO` nuevo y admitirá exactamente `STOCK_PROPIO` o `CONSIGNACION`. Un `INGRESO` histórico con modalidad o costo insuficiente se expondrá como tramo explícitamente no valorizable, sin backfill; los datos malformados siguen fallando cerradamente.
- Resolver las salidas `VENTA`, `CONSUMO_PROPIO`, `ROTURA_MERMA` y `CORRECCION` negativa contra las tandas abiertas por FIFO según el orden físico append-only del ledger, no según una fecha editable.
- Mantener faltantes de costo como salidas pendientes ordenadas; el siguiente `INGRESO` las valuará antes de dejar remanente como nueva tanda abierta, conservando de todos modos la identidad histórica de esa tanda.
- Extender el resumen privado de Inventario para separar capital en stock propio, valor de mercadería en consignación y valor físico total a costo; los saldos y movimientos existentes se conservan sin backfill ni reescritura.
- Agregar un detalle por producto que explique tandas abiertas, asignaciones de salida, faltantes pendientes y el historial de tandas agotadas, sin selección manual de tanda.
- Definir el tratamiento trazable de correcciones positivas y negativas: una positiva sólo revierte parcial o totalmente una salida negativa referida del mismo producto, dentro de su cantidad neta no revertida; primero cancela su tramo pendiente y luego restaura las capas FIFO valorizadas. No modifica precios de venta, Finanzas, disponibilidad pública, proveedor efectivo, vencimientos ni lotes reales.

## Capabilities

### New Capabilities
- `inventory-cost-layer-valuation`: proyección privada, determinista y recalculable de tandas internas, asignaciones FIFO, faltantes de costo y valorización segregada por modalidad.

### Modified Capabilities
- `stock-movement-ledger-api`: exponer de forma privada y de sólo lectura la proyección de costo derivada del ledger, manteniendo su orden append-only, inmutabilidad y compatibilidad histórica.
- `inventory-admin-operations`: ampliar la vista de Inventario y el detalle de producto con valorización y trazabilidad de tandas, sin cambiar los flujos públicos ni financieros.
- `supply-and-inventory-data-contract`: precisar que las tandas son una derivación interna de costo, no lotes físicos ni una nueva fuente de verdad, y preservar el tratamiento de históricos.

## Impact

- Afecta únicamente el diseño futuro de la planilla operativa privada, Apps Script y el panel `admin/`.
- `Movimientos_Stock` sigue siendo la única fuente de los movimientos y del saldo; la proyección no publica costos, proveedores, tandas ni datos operativos en B2C, B2B, CSV o JSON. La modalidad actual `CONTRA_PEDIDO` de un producto no oculta ni revaloriza las tandas históricas abiertas: sólo es informativa respecto de ellas.
- No incluye implementación, backfill, reescritura de movimientos, cambios de precios o márgenes, Finanzas, catálogo, workflow, deployment, pruebas con datos productivos, planillas temporales ni lotes/vencimientos reales.
