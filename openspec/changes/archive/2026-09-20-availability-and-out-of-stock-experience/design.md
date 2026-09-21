## Context

Ver `proposal.md` y la capability nueva `public-product-availability`. La señal `Sin_Stock` fue definida por C-01 como decisión manual global e independiente del saldo; C-02 y C-04 preservan sus datos internos fuera de las superficies públicas. Hoy B2C y B2B usan las mismas interacciones vanilla de `shared/app.js`, con el canal seleccionado por `CANAL`, el carrito persistido como referencias mínimas en `sessionStorage` y un QR que reconstruye esas referencias antes del flujo de WhatsApp.

## Goals / Non-Goals

**Goals:**

- Propagar sólo el booleano público `Sin_Stock` en la representación de producto que ya consumen los sitios, sin derivarlo de saldo ni de otros metadatos de abastecimiento.
- Actualizar sólo la allowlist/filtro, la materialización/workflow existente y los JSON generados B2C/B2B que sean necesarios para transportar esa señal, sin añadirla a `admin/productos.json`.
- Centralizar el cálculo y las guardas de disponibilidad para que tarjeta, detalle, restauración, QR y envío a WhatsApp no diverjan.
- Conservar la separación ya existente por `CANAL`, incluidas sus fuentes, precios, sesión y mensajes.

**Non-Goals:**

- No sustituir el flujo de pedido por una reserva, una alerta ni una comprobación de stock en tiempo real.
- No guardar el estado de disponibilidad en el carrito ni cambiar cantidades automáticamente; se recalcula desde el catálogo vigente al reconstruir o renderizar.
- No cambiar la clasificación privada, saldo, Google Sheets, Apps Script, deployment ni knowledge-base; el único cambio futuro de datos es la publicación mínima dentro del pipeline público existente.

## Decisions

### 1. Señal pública mínima, compatible y delimitada por allowlist

En el apply futuro, se actualizarán la allowlist/filtro de publicación y la materialización/workflow ya existentes para que los JSON generados de B2C y B2B incluyan únicamente `Sin_Stock` como booleano de producto. Los productos históricos que todavía no traigan el campo se interpretarán como `false`, conforme al contrato C-01, para conservar el comportamiento vigente. No se agregará ningún cálculo que lea o infiera saldo físico.

Proveedor, modalidad, saldo, costo, movimientos y cualquier otro metadato interno seguirán fuera de esas allowlists y JSON. `admin/productos.json` no interviene en la UX pública de C-06: no se le agregará `Sin_Stock` ni se ampliará el catálogo reducido del admin.

Alternativa descartada: publicar saldo o modalidad y resolver la disponibilidad en navegador. Divulgaría datos operativos, haría la señal menos clara y contradice la independencia entre saldo y disponibilidad.

### 2. Consistencia eventual y texto de indisponibilidad

La señal que ven B2C y B2B será eventualmente consistente con el ciclo actual de publicación del catálogo. Hasta que ese ciclo materialice el cambio, los sitios pueden seguir mostrando el último JSON publicado; C-06 no incorpora consulta administrativa, polling, bloqueo instantáneo ni stock en tiempo real.

El texto exacto y único sugerido en búsqueda, tarjeta, detalle, carrito y QR es: `Este producto no está disponible.` No comunica reposición, fecha, alerta, reserva, sustitución ni disponibilidad futura.

### 3. Predicado único de producto no agregable y verificación en los límites del flujo

`shared/app.js` incorporará un predicado puro sobre el producto vigente para determinar `Sin_Stock`, y una verificación de carrito que encuentre ítems actualmente no disponibles. Las renderizaciones de búsqueda/tarjeta y detalle usarán el predicado para conservar el producto visible, sustituir o deshabilitar el control de agregar y mostrar el mismo aviso breve. La función que agrega al carrito hará una segunda verificación defensiva, de modo que un disparador programático o una UI desactualizada no pueda introducir el ítem.

La restauración de `sessionStorage` y la reconstrucción desde QR resolverán cada referencia contra el catálogo vigente antes de renderizar. El carrito conservará sus referencias actuales (producto y cantidad), pero marcará visualmente los ítems disponibles y no disponibles al renderizar; no persistirá una copia de `Sin_Stock`. Los ítems que se volvieron no disponibles no se borrarán: tendrán la eliminación existente y un aviso de revisión.

Alternativa descartada: ocultar el producto o eliminar automáticamente el renglón. Oculta información útil y no permite que la persona revise qué cambió antes de decidir.

### 4. Bloqueo tanto visual como funcional antes de WhatsApp y QR

El drawer mostrará un aviso de carrito a revisar y dejará inactiva la acción de confirmar cuando exista al menos un ítem `Sin_Stock`. Las funciones que construyen/abren el pedido por WhatsApp y las que generan el QR repetirán la verificación antes de realizar efectos externos. Así, un botón visualmente desactualizado, el flujo mobile directo o la opción QR de escritorio no pueden generar una confirmación nueva mientras el carrito requiera resolución. Al quitar los ítems señalados, el flujo existente vuelve a habilitarse sin crear reserva ni alterar los demás renglones.

Alternativa descartada: excluir sólo los ítems no disponibles del mensaje y enviar el resto. Cambiaría silenciosamente la intención de pedido; la especificación requiere una decisión explícita de revisar o eliminar.

### 5. Un mismo comportamiento técnico, separados por canal

La lógica común se implementará detrás del `CANAL` ya configurado por cada `index.html`. Cualquier selector, mensaje y prueba se ejecutará por separado en B2C y B2B usando su catálogo, precio y clave de sesión actuales. No habrá un carrito compartido, fallback de precio, consulta cruzada ni reutilización de datos comerciales entre canales.

Alternativa descartada: una lista global de disponibilidad o una sesión compartida. Puede mezclar reglas y precios de canales que el contrato mantiene independientes.

## Risks / Trade-offs

- [El HTML de tarjetas, detalle y carrito tiene distintos puntos de entrada] → Concentrar la decisión en predicados/guardas pequeños y probar cada superficie contra el mismo producto disponible y no disponible.
- [Un estado de sesión o hash QR antiguo puede contener un producto recién no disponible] → Revalidar contra el catálogo vigente al reconstruir y nuevamente antes de WhatsApp/QR; mantener el renglón identificable.
- [Un booleano ausente en productos históricos podría interrumpir el catálogo] → Tratar sólo el campo ausente como `false`; una señal explícita `true` siempre gana.
- [La publicación no es instantánea] → Mantener el ciclo vigente y describir el estado como eventualmente consistente; no introducir consultas, reservas ni garantías de disponibilidad inmediata.
- [El mensaje puede parecer una garantía de reposición] → Usar texto de no disponibilidad simple, sin fechas, alertas, reservas, sustituciones ni referencias a stock en tiempo real.
- [Cambios visuales pueden perder legibilidad en mobile] → Revisar controles bloqueados, aviso del carrito y eliminación en desktop y mobile de ambos canales.

## Migration Plan

1. En un apply aprobado, agregar `Sin_Stock` booleano a la allowlist/filtro y a la materialización/workflow pública ya existentes, para generar los JSON B2C/B2B con valores sintéticos en pruebas; no modificar `admin/productos.json` ni publicar campos internos.
2. Implementar los predicados, renderizado y guardas de flujo en los recursos vanilla existentes; mantener las claves de sesión y el formato QR compatibles.
3. Ejecutar pruebas focalizadas y la revisión manual por canal en desktop/mobile antes de cualquier publicación.
4. Si se necesita revertir, retirar la UI y las guardas de C-06 y dejar los carritos como referencias actuales; no modificar clasificaciones, ledger ni datos operativos.
