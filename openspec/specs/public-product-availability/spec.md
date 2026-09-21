# public-product-availability Specification

## Purpose
Definir una experiencia pública por canal que refleje la decisión manual `Sin_Stock` sin exponer operación interna ni simular reserva o stock en tiempo real.

## Requirements

### Requirement: Contrato mínimo de publicación pública de disponibilidad
El pipeline público existente MUST añadir `Sin_Stock` como el único campo operativo nuevo permitido en los catálogos JSON generados de B2C y B2B. El campo MUST ser booleano y un producto que no lo incluya MUST interpretarse como `Sin_Stock = false`. La allowlist/filtro y el workflow/materialización existentes MUST mantener excluidos proveedor, modalidad, saldo físico, costos, movimientos y todo otro campo interno. C-06 MUST NOT añadir `Sin_Stock` a `admin/productos.json`, ya que ese catálogo reducido no es necesario para esta experiencia pública.

El estado publicado MUST ser eventualmente consistente con el ciclo actual de publicación de catálogo. El requisito MUST NOT prometer bloqueo instantáneo, consulta administrativa, reserva ni stock en tiempo real.

#### Scenario: Materialización mínima por canal
- **WHEN** el ciclo vigente materializa los catálogos públicos B2C y B2B
- **THEN** cada JSON incluye únicamente el nuevo booleano `Sin_Stock` necesario para el producto y mantiene excluidos todos los campos internos

#### Scenario: Catálogo histórico sin señal publicada
- **WHEN** un producto público no contiene el campo `Sin_Stock`
- **THEN** el sitio lo interpreta como `false` sin inferir su disponibilidad desde saldo u otro dato interno

#### Scenario: Cambio pendiente de publicación
- **WHEN** la decisión manual cambia después del último ciclo de publicación
- **THEN** el sitio puede mostrar el último estado público materializado hasta el próximo ciclo, sin afirmar bloqueo inmediato ni disponibilidad en tiempo real

### Requirement: Disponibilidad pública determinada sólo por la decisión manual global
Los sitios públicos MUST usar `Sin_Stock` como una señal booleana global por producto para determinar si puede iniciarse una nueva compra. Un producto con `Sin_Stock = true` MUST considerarse no agregable, y uno con `Sin_Stock = false` MUST permanecer elegible según las demás reglas existentes de su propio canal. El saldo físico, incluso cero o negativo, MUST NOT cambiar esa señal, bloquear por sí solo una compra ni mostrarse como disponibilidad pública. La experiencia MUST NOT prometer reserva, reposición, alerta de disponibilidad ni stock en tiempo real.

#### Scenario: Saldo físico cero sin bloqueo manual
- **WHEN** un producto tiene saldo físico cero y `Sin_Stock = false`
- **THEN** el sitio lo mantiene elegible para una nueva compra y no lo presenta como agotado por ese saldo

#### Scenario: Bloqueo manual global
- **WHEN** un producto tiene `Sin_Stock = true`, sin importar su modalidad o saldo físico
- **THEN** el sitio lo presenta como no disponible para una nueva compra sin mostrar saldo, proveedor, costo u otro dato operativo

### Requirement: Producto sin stock visible y no agregable en cada canal público
En B2C y B2B, un producto con `Sin_Stock = true` MUST permanecer visible en los resultados de búsqueda, en sus tarjetas y en su detalle, con el texto exacto `Producto sin stock.` y sin un control que permita agregarlo al carrito. Cada canal MUST aplicar el estado sobre su propio catálogo, precios, mensajes y carrito; MUST NOT reutilizar precios, reglas comerciales, clientes, métricas ni estado de carrito del otro canal.

#### Scenario: Resultado de búsqueda y tarjeta no disponibles
- **WHEN** una persona busca o navega un producto con `Sin_Stock = true` en B2C o en B2B
- **THEN** el resultado y la tarjeta conservan el producto visible, muestran que no está disponible y no permiten agregarlo al carrito de ese canal

#### Scenario: Detalle no disponible
- **WHEN** una persona abre el detalle de un producto con `Sin_Stock = true`
- **THEN** el detalle informa su no disponibilidad y no ofrece una acción que agregue ese producto al carrito

#### Scenario: Producto disponible por decisión manual
- **WHEN** una persona consulta un producto con `Sin_Stock = false` y que cumple las reglas existentes de su canal
- **THEN** el flujo conserva la posibilidad existente de agregarlo sin heredar reglas ni precios del otro canal

### Requirement: Carrito restaurado conserva ítems no disponibles y bloquea una nueva confirmación
Al restaurar un carrito, cada canal MUST contrastar sus ítems con la señal publicada actualmente de `Sin_Stock`. Si un ítem pasó a `Sin_Stock = true`, el carrito MUST conservarlo identificable junto con el texto exacto `Producto sin stock.`, MUST ofrecer una acción simple para eliminarlo o revisar el carrito y MUST bloquear la generación, apertura o envío de una nueva confirmación por WhatsApp mientras ese ítem permanezca. El sitio MUST NOT eliminarlo automáticamente, reservarlo ni modificar cantidades como sustitución.

#### Scenario: Carrito restaurado con ítem recién no disponible
- **WHEN** se restaura un carrito que contiene un producto que ahora tiene `Sin_Stock = true`
- **THEN** el ítem sigue identificado como no disponible, se puede eliminar o revisar el carrito y no se puede generar ni enviar una nueva confirmación por WhatsApp hasta resolverlo

#### Scenario: Carrito restaurado sin ítems no disponibles
- **WHEN** se restaura un carrito cuyos productos conservan `Sin_Stock = false`
- **THEN** el flujo de confirmación por WhatsApp conserva el comportamiento existente del canal

### Requirement: Accesos QR respetan la disponibilidad actual
Todo acceso por QR que dirija a un producto o preconfigure una intención de compra MUST aplicar la señal publicada actualmente de `Sin_Stock` antes de agregar el producto o habilitar una nueva confirmación. Si el producto está no disponible, el acceso MUST mantenerlo identificable en la superficie correspondiente, informar con el texto exacto `Producto sin stock.` y ofrecer revisar o eliminar el ítem cuando exista carrito; MUST NOT crear una reserva ni habilitar el envío de WhatsApp para ese producto.

#### Scenario: QR de producto no disponible sin carrito previo
- **WHEN** una persona abre un QR de un producto con `Sin_Stock = true` y no tiene un carrito previo
- **THEN** ve el producto y su estado no disponible, sin que el QR lo agregue al carrito ni habilite una confirmación nueva

#### Scenario: QR con carrito que contiene un ítem no disponible
- **WHEN** una persona abre un QR y el carrito resultante contiene un producto con `Sin_Stock = true`
- **THEN** el carrito identifica ese ítem, permite revisarlo o eliminarlo y bloquea la nueva confirmación por WhatsApp hasta resolverlo

### Requirement: Límite de datos y de alcance público
La experiencia pública MUST recibir y usar sólo la señal de disponibilidad necesaria para el producto y MUST NOT exponer ni derivar saldo físico, modalidad de abastecimiento, proveedor, costo, movimientos u otros datos internos. C-06 MUST NOT cambiar Sheets, Apps Script, deployment ni knowledge-base, ni introducir reservas, alertas, stock en tiempo real, sustituciones o datos reales de clientes en pruebas. El futuro cambio mínimo al workflow/materialización existente se limita a generar el campo público autorizado; esta propuesta no lo ejecuta.

#### Scenario: Superficie pública de disponibilidad
- **WHEN** una persona utiliza B2C, B2B, búsqueda, detalle, carrito o QR
- **THEN** ve únicamente el estado público necesario y no recibe datos de inventario, proveedores, costos, movimientos ni información personal
