## Purpose

Provide private, copyable supplier fulfillment worklists from active-order item snapshots while preserving channel, supplier, modality, and catalog privacy boundaries.

## ADDED Requirements

### Requirement: Derive private worklists from active-order snapshots
The system SHALL derive fulfillment worklists only from item snapshots belonging to active orders. It MUST include an item only when its snapshot identifies `CONTRA_PEDIDO`, a valid habitual supplier identifier, its channel, product snapshot, and quantity snapshot. It MUST exclude `CONSIGNACION`, `STOCK_PROPIO`, cancelled orders, delivered orders, and historical items without the required supply snapshots. The system MUST NOT infer or backfill a missing snapshot from the current catalog, stock ledger, or supplier records.

#### Scenario: Active pending order with contra-pedido item
- **WHEN** an active order contains a complete `CONTRA_PEDIDO` item snapshot
- **THEN** the item is eligible for the worklist identified by its snapshot channel, habitual supplier, and modality

#### Scenario: Historical item lacks supply snapshot
- **WHEN** an otherwise active historical order item lacks a required supply snapshot
- **THEN** the system excludes the item and does not derive supply data from current catalog values

#### Scenario: Non-purchase modalities are present
- **WHEN** active orders contain `CONSIGNACION` or `STOCK_PROPIO` item snapshots
- **THEN** the system excludes those lines from every contra-pedido fulfillment worklist

### Requirement: Preserve worklist grouping and quantities
The system SHALL create a distinct worklist for each `(channel, habitual supplier, modality)` snapshot group and SHALL aggregate matching product snapshots and quantities only within that group. It MUST preserve the snapshot product identity and quantity used to form each output, and it MUST NOT merge B2C with B2B, different habitual suppliers, or different modalities. A manual `Sin_Stock` mark or a physical balance MUST NOT automatically add, remove, reserve, or prioritize an otherwise eligible item.

#### Scenario: Mixed order spans two suppliers
- **WHEN** one active order has eligible `CONTRA_PEDIDO` snapshots for two habitual suppliers
- **THEN** the system produces separate supplier worklists without mixing their products or quantities

#### Scenario: Same product occurs in separate channels
- **WHEN** eligible item snapshots for the same product belong to B2C and B2B
- **THEN** the system keeps their quantities in separate channel worklists

#### Scenario: Eligible line is marked sin stock
- **WHEN** an eligible active-order item is associated with a product manually marked `Sin_Stock`
- **THEN** the item remains governed by its snapshot and no balance-based or low-stock worklist behavior is created

### Requirement: Preserve the Distrosec-compatible worklist
The system SHALL provide a Distrosec-compatible aggregated worklist as a projection of the applicable Distrosec `CONTRA_PEDIDO` group. It MUST preserve the existing copy-oriented product-and-quantity behavior while respecting the same channel and snapshot grouping boundaries as all other supplier worklists.

#### Scenario: Distrosec has eligible active-order lines
- **WHEN** eligible `CONTRA_PEDIDO` item snapshots identify Distrosec as their habitual supplier
- **THEN** the system presents a compatible aggregated Distrosec worklist for the matching channel group

#### Scenario: Non-Distrosec line accompanies Distrosec line
- **WHEN** an active order contains eligible lines for Distrosec and another supplier
- **THEN** the Distrosec-compatible worklist contains only the Distrosec group

### Requirement: Keep fulfillment worklists private and non-mutating
The system SHALL make worklists available only in authorized private administrative operations. Copying or viewing a worklist MUST NOT modify orders, item snapshots, catalog data, stock balances, stock movements, payment records, or order states. It MUST NOT expose supplier identifiers, modalities, internal order data, costs, stock data, or customer personal data in B2C, B2B, public catalog output, or publication workflows.

#### Scenario: Operator copies a supplier worklist
- **WHEN** an authorized operator copies a worklist
- **THEN** the underlying orders, item snapshots, inventory records, and order states remain unchanged

#### Scenario: Public catalog is generated
- **WHEN** the public catalog or either public channel consumes its normal data
- **THEN** supplier fulfillment worklist data is absent from that output
