## 1. Approval, Safety Net and Preflight

- [x] 1.1 Obtain explicit approval of the C-02 proposal and its CRITICAL-governance impact before changing Sheets, Apps Script or generated catalogs; verify the approved revision matches `openspec status --change stock-movement-ledger-api --json`.
- [x] 1.2 Run the complete existing `node --test` suite before editing production files, record the passing baseline, and stop as a pre-existing failure if any test fails.
- [x] 1.3 Perform a read-only deployment preflight: verify the catalog Script Property is available, `Proveedores` uses the approved headers with unique IDs, C-01 legacy-code preservation is complete, and the current `Productos`/workflow schemas match the design; verify the command/report contains no real contact data and makes no writes.

## 2. Public Catalog Privacy (Strict TDD)

- [x] 2.1 RED: add a failing catalog-privacy test that asserts generated `shared/catalogo.json` contains only the expected public allowlist and that B2C/B2B do not invoke the new administrative actions; verify it fails against current behavior, recording any observed prohibited keys only as baseline evidence rather than as the expected assertion.
- [x] 2.2 GREEN: replace raw catalog-row publication in `.github/workflows/actualizar-catalogo.yml` with explicit public allowlists and prohibited-field assertions, regenerate the catalog without dependencies or a build system, and verify the privacy test passes while current B2C/B2B consumer fields remain present.
- [x] 2.3 TRIANGULATE/REFACTOR: cover products and both price tables plus an unknown synthetic private column, verify `Sin_Stock` remains unpublished in C-02 and `admin/productos.json` retains its existing admin cost field without provider contacts, notes or movements, then rerun the focused and baseline suites.

## 3. Provider and Product Classification Contract (Strict TDD)

- [x] 3.1 RED: add failing unit tests with Apps Script service stubs for provider validation, distinct create/update actions, immutable provider PKs targeted by `Id_Proveedor_Original`, historical product defaults, allowed modalities, boolean `Sin_Stock`, active-provider FK checks and fail-closed C-01 preconditions; verify failures reference behavior not yet implemented.
- [x] 3.2 GREEN: add the minimum header-by-name readers/writers and `listarProveedores`, `crearProveedor`, `actualizarProveedor` and `clasificarProducto` actions in `apps-script/Code.gs`, using the configured catalog spreadsheet and no backfill; verify the focused tests pass.
- [x] 3.3 TRIANGULATE/REFACTOR: add cases for duplicate provider rows, a missing update target, attempted PK mutation, inactive/missing FK, invalid modality, non-boolean availability and an existing unknown column, then refactor shared header helpers and verify all tests stay green.

## 4. Immutable Movement Writer (Strict TDD)

- [x] 4.1 RED: add failing tests for the exact `Movimientos_Stock` contract, server-generated ID/date, every allowed type/sign combination, required ingreso cost, correction note and a prior same-product antecedent, rejection of missing/nonexistent/future/self/cross-product references, unmanaged products, invalid payload atomicity and rejection of manual `VENTA`; verify the focused tests fail before production code is added.
- [x] 4.2 GREEN: implement sheet initialization, validation and append-only `registrarMovimiento` behavior without edit/delete actions or `Proveedor_Efectivo`; verify the focused tests pass with the minimum implementation.
- [x] 4.3 TRIANGULATE/REFACTOR: add happy and edge cases for positive and negative corrections, zero/non-finite quantities, missing products, valid prior same-product references and preserved antecedents, refactor without changing behavior, and verify the focused plus baseline suites remain green.

## 5. Locking and Sale Idempotency Boundary (Strict TDD)

- [x] 5.1 RED: add failing tests for lock acquisition on every public write, already-locked internal primitives, identical sale retries and incompatible key collisions, requiring the exact key `VENTA:<Id_Pedido>:<Item_Id>` and at most one committed row; verify each test fails for the expected missing behavior. This is automated lock/idempotency coverage, not a claim of real productive concurrency; the latter is deferred to the integrated C-07 pilot.
- [x] 5.2 GREEN: centralize writes under `LockService`, generate unique movement IDs inside the critical section and implement the internal idempotent `VENTA` writer while keeping it disconnected from `guardarPedido`; verify lock-boundary and retry tests pass.
- [x] 5.3 TRIANGULATE/REFACTOR: cover same-key/different-product, quantity, order and item collisions plus a save to `Entregado` that creates no movement, then rerun all tests and confirm no order-flow regression.

## 6. Derived Stock Summary (Strict TDD)

- [x] 6.1 RED: add failing summary tests for mixed movement sequences, a managed product with no movements, a contra-pedido or historical product, zero stock with `Sin_Stock = false`, negative stock and malformed ledger rows; verify malformed data requires an explicit error with no partial balances.
- [x] 6.2 GREEN: implement `resumenStock` as a pure validating batch read and algebraic reduction by product, failing closed without creating a missing ledger and on any malformed row, returning `null` for unmanaged stock and never mutating Sheets or `Sin_Stock`; verify the focused tests pass.
- [x] 6.3 TRIANGULATE/REFACTOR: add a second product and mixed modalities to prove isolation plus malformed rows for different contract violations, verify every invalid case returns an explicit error and no balances, refactor the reducer, and verify all tests remain green.

## 7. API Compatibility and Manual Verification

- [x] 7.1 Add integration-style tests for the new `doGet`/`doPost` routes, `{ ok: true }`/`{ ok: false, error }` envelopes and no partial writes, and verify all pre-existing pedido, cliente, contacto and código-promocional tests still pass.
- [x] 7.2 In an approved controlled Sheet environment, initialize only missing headers and `Movimientos_Stock`, then verify no historical cells, orders, items or movements were backfilled and stop without migration if any preflight differs.
- [x] 7.3 Update the existing Apps Script deployment in place to version 16 without changing its URL or creating another deployment; retain versions 15 and 14 as rollback targets; and record read-only production smoke evidence (`listarProveedores = 3`, `resumenStock = 468`). By explicit decision, perform no synthetic production writes and defer real concurrent-write verification to the integrated C-07 pilot.
- [x] 7.4 Verify end-to-end that `shared/catalogo.json`, B2C and B2B contain no supplier data, FK, modality, costs or movements; that `Sin_Stock` public behavior is unchanged; and that the admin-oriented API is documented as using the current weak protection rather than strong authentication.
- [x] 7.5 Run `node --test`, `openspec validate stock-movement-ledger-api --strict` (or the supported equivalent) and `openspec status --change stock-movement-ledger-api --json`; record Strict TDD evidence for every implementation task and leave C-03/C-04/C-06 responsibilities unimplemented.

## C-02 verification evidence

| Scope | Test file | Layer | Safety net / RED | GREEN | Triangulation / refactor |
|---|---|---|---|---|---|
| Public catalog privacy | `tests/catalog-privacy.test.js` | Artifact/integration | Original raw artifact exposed non-allowlisted supplier/cost fields | Production allowlist sanitizes the checked-in artifact | Synthetic unknown fields, all public tables, actual `shared/catalogo.json`, public consumers and reduced admin artifact covered |
| Provider and classification contract | `tests/apps-script-stock.test.js` | Unit/integration with Apps Script stubs | Existing suite was green before C-02; new routes initially absent | Create/update/list/classification contract implemented | Duplicate/missing/immutable PK, active FK, modality, boolean, unknown columns and C-01 fail-closed cases covered |
| Exact catalog tab routing | `tests/apps-script-stock.test.js` | Unit/integration with Apps Script stubs | Live-title-only stub reproduced the mismatch as 1 failure (19/20 focused suite) | `HOJA_PRODUCTOS` now uses the exact `⬛Productos` title; focused suite green (20/20) | Stub exposes no unprefixed fallback, proving reads and writes target only the verified live tab |
| Movement ledger and summary | `tests/apps-script-stock.test.js` | Unit/integration with Apps Script stubs | Invalid first correction, manual reserved namespace, full retry comparison and direct-lock paths reproduced as 4 failures | Focused Apps Script suite green (23/23) | Cost/reference/note collisions, forbidden manual order/item fields, absent-ledger atomicity, single initialization and locked/unlocked paths covered; this does not claim real productive concurrency |

Latest local validation: `node --test` passed 39/39, `git diff --check` reported no errors, and `openspec validate stock-movement-ledger-api --strict` passed. Focused Apps Script validation passed 23/23. This automated evidence covers `LockService` boundaries and idempotency but does not claim real concurrent execution in production.

Deployment evidence: the existing deployment uses version 16; versions 15 and 14 remain available for rollback. Read-only production smoke checks returned 3 providers and 468 stock-summary products. No synthetic production writes were performed. Real concurrent writes are deferred to the C-07 integrated pilot.
