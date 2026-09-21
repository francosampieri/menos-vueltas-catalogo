## 1. Dependency and private read-model preparation

- [x] 1.1 Record the responsible party's decision: C-03 is implemented and covered by its approved suite and smoke checks, while its real operational validation remains deferred; confirm C-04's dependency status and proceed with C-05 without creating temporary environments or blocking on that deferred observation.
- [x] 1.2 Identify the existing private administrative order/item read boundary and the current Distrosec copy-list behavior; verify the selected path does not require changes to Sheets schema, public JSON, publication workflow, B2C, or B2B.

## 2. Snapshot-based fulfillment calculation

- [x] 2.1 Add a read-only calculation that filters active item snapshots to complete `CONTRA_PEDIDO` lines and excludes `CONSIGNACION`, `STOCK_PROPIO`, cancelled, delivered, and incomplete historical lines; verify focused non-personal fixtures cover each inclusion and exclusion.
- [x] 2.2 Group eligible snapshot lines by channel, habitual supplier, and modality, aggregating product snapshot quantities only inside each group; verify fixtures cover a single supplier, a mixed order with two suppliers, two minor suppliers, and identical products across channels.
- [x] 2.3 Preserve a Distrosec-compatible copy-oriented projection from its matching group; verify a mixed Distrosec/non-Distrosec fixture cannot add a non-Distrosec line to that projection.
- [x] 2.4 Confirm a manual `Sin_Stock` mark or a physical balance does not create, exclude, reserve, prioritize, or replenish a worklist line; verify the focused line-agotada fixture preserves snapshot-driven behavior.

## 3. Private administrative presentation

- [ ] 3.1 Present each derived worklist and its copy action only in the authorized private admin flow, with terminology that does not assume Distrosec is the only provider; verify no order state, item snapshot, stock movement, balance, or payment record changes after view or copy.
- [x] 3.2 Ensure the private presentation omits customer personal data, costs, balances, and ledger details and that no provider/modalidad/worklist data enters B2C, B2B, public catalog output, or publication workflows; verify through the affected admin and public data paths.

## 4. Focused verification and rollout guard

- [ ] 4.1 Run the focused deterministic tests/validations and record results for all specified grouping and exclusion scenarios without real customer data; verify the existing test/validation baseline remains green.
- [ ] 4.2 Manually verify the affected private admin flow on desktop and mobile: copy a one-supplier worklist, inspect a mixed-supplier order, and confirm cancelled/delivered lines are absent; verify no state transition or public-channel change occurs.
