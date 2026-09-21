## Context

See `proposal.md` for the motivation. C-01 established private supplier and modality snapshots; C-02 establishes a private inventory ledger; C-04 defines private inventory administration. C-03 has planning artifacts but its real validation in `main` remains pending, so this change must not be applied or treated as a dependency already validated.

The existing operational list assumes Distrosec as the single source of purchase. Its replacement must use immutable item snapshots from active orders, rather than current catalog classification or stock balance. The current order state machine remains unchanged.

## Goals / Non-Goals

**Goals:**

- Derive private, copyable purchase worklists from a deterministic snapshot filter and grouping key.
- Preserve the Distrosec operational list as a compatible projection of the general model.
- Keep the worklist calculation read-only and independently testable with non-personal fixtures.

**Non-Goals:**

- Changing Sheets/App Script schemas, the catalog publication pipeline, B2C/B2B public behavior, or the order state machine.
- Creating movements, reservations, replenishment, alerts, low-balance lists, automatic substitutions, or financial records.
- Inferring missing supplier or modality data for historical items.

## Decisions

### Snapshot-only eligibility and grouping

Use snapshots from item lines of active orders as the exclusive source. Filter to complete `CONTRA_PEDIDO` snapshots and group by `(channel, Id_Proveedor, Modalidad_Abastecimiento)` before aggregating matching product snapshots and quantities.

This preserves the historic purchase intent even if catalog data is later reclassified and makes channel separation explicit. Using current catalog values or stock/ledger values was rejected because either can reinterpret a saved order and would blur purchase work with inventory management.

### Explicit status filter without state transitions

Treat all existing non-cancelled, non-delivered operational states as active inputs; exclude `Cancelado` and `Entregado`. The worklist remains a read model and never writes an order state.

This is compatible with the current state machine and avoids turning list generation or copying into an operational transition. Adding a worklist-specific state was rejected because it would change order lifecycle semantics.

### Distrosec as a compatibility projection

Model Distrosec as one habitual-supplier group and render its existing copy-friendly aggregate from that group within a channel boundary. Do not retain a special source path or a cross-channel aggregate.

This preserves the established operation while allowing additional suppliers without conflating their data. Keeping Distrosec as a separate hard-coded list was rejected because it would recreate the single-supplier assumption.

### Read-only private presentation

Expose only the derived group labels, product snapshots, and quantities to authorized administrative users. The worklist query and copy action must have no writes and must not retrieve or render customer personal data, costs, balances, or ledger records.

This keeps the surface minimal and protects the boundary between private operational data and public catalog channels. Reusing public catalog output was rejected because it omits private supply snapshots and would disclose internal data if expanded.

## Risks / Trade-offs

- [C-03 snapshots are not yet validated in `main`] → Do not start apply until that validation is completed and the dependency status is confirmed; tests use only fixture snapshots.
- [Legacy/historical lines lack complete supply data] → Exclude them deterministically without catalog inference and surface no synthetic purchase line.
- [Distrosec compatibility could encourage a cross-channel aggregate] → Define compatibility as a projection inside the same channel boundary.
- [An active order can contain outdated product labels] → Deliberately retain its item snapshot so the list reflects the ordered line, not later catalog edits.

## Migration Plan

1. Confirm C-03's real validation in `main` and C-04's dependency status before any apply work.
2. Implement the read-only calculation and private panel presentation behind the existing administrative boundary, without data migration or public publication changes.
3. Verify focused fixture cases and manual copying in the affected admin flow.
4. Roll back by restoring the prior private Distrosec list presentation; no orders, inventory data, Sheets, Apps Script schema, or public artifacts require migration or reversal.
