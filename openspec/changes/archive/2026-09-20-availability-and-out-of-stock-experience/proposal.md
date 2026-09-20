## Why

La decisión operativa global `Sin_Stock` ya existe en la clasificación privada, pero todavía no tiene una experiencia pública que impida iniciar un pedido nuevo de un producto no disponible. C-06 traslada sólo esa señal aprobada a B2C y B2B de forma clara, sin confundirla con el saldo físico ni prometer disponibilidad en tiempo real.

## What Changes

- En el apply futuro, extender la allowlist/filtro y la materialización pública existentes para publicar en los JSON B2C y B2B únicamente la señal global y manual `Sin_Stock`; debe ser booleana y su ausencia debe interpretarse como `false`.
- Mantener excluidos del pipeline y de los JSON públicos proveedor, modalidad, saldo, costos, movimientos y cualquier otro campo interno; `admin/productos.json` no necesita `Sin_Stock` para este alcance y no se modificará.
- Mostrar los productos `Sin_Stock` en búsqueda, tarjetas y detalle, pero impedir agregarlos al carrito en B2C y B2B con sus reglas y precios separados.
- Validar también la disponibilidad al restaurar un carrito y al generar o abrir un pedido por QR: un ítem que pasó a `Sin_Stock` queda identificable, pero bloquea una nueva confirmación por WhatsApp hasta eliminarlo o revisar el carrito.
- Mantener el saldo físico en cero o negativo independiente de la señal pública: no modifica `Sin_Stock` ni bloquea ventas por sí mismo.
- Documentar que el estado público se actualiza de forma eventualmente consistente con el ciclo actual de publicación: no promete bloqueo instantáneo ni stock en tiempo real.
- Usar como texto único sugerido de indisponibilidad: `Este producto no está disponible.`
- Excluir reservas, alertas, sustituciones, stock en tiempo real, datos de proveedores y costos, y cualquier cambio inmediato a Sheets, Apps Script, workflow, deployment, JSON público o knowledge-base; esta propuesta sólo planifica esos cambios futuros mínimos de materialización pública.

## Capabilities

### New Capabilities

- `public-product-availability`: Experiencia pública por canal para presentar y aplicar la decisión manual global `Sin_Stock` en catálogo, carrito restaurado y flujos de pedido.

### Modified Capabilities

- Ninguna.

## Impact

- Implementación futura limitada al pipeline existente de publicación de catálogos B2C/B2B, sus JSON generados y HTML, CSS y JavaScript vanilla de los sitios y recursos compartidos que consumen la disponibilidad aprobada.
- El contrato operativo de C-01/C-02 y la operación privada de C-04 permanecen sin cambios; C-03 sigue activo y fuera de alcance.
- Se requerirán pruebas focalizadas y revisión manual útil de los flujos afectados en desktop y mobile, sin entornos temporales ni datos reales.
