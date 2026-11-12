# Proposal

## Why

Store notifications don't match the documented contract. `docs/core/stores.md` says "Stores only notify observers of the specific properties that changed", but four tests in `packages/core/tests/known-issues.spec.ts` show otherwise:

- **Key tracking is lost.** Only the first computation to enumerate a store object's keys subscribes to them, and it loses that subscription the first time it re-runs. A second effect calling `Object.keys(store)` never re-runs; the first re-runs once and then never again.
- **Key readers re-run on value changes.** Any property write notifies everything that enumerated the object's keys, even when no key was added or removed.
- **Unchanged writes notify.** Writing a property's current value re-runs that property's observers, because store property signals are created with equality turned off. The commit that introduced stores (9d54f25) gives no reason for it.

Fixing the first issue alone would make the second one worse: every key reader would then re-run on every value write. So the three are fixed together.

## What Changes

- Every computation that enumerates a store object's keys (`Object.keys`, `Object.entries`, `for...in`, `Reflect.ownKeys`) subscribes to that object's key set, and stays subscribed across re-runs.
- **BREAKING:** key-set subscribers re-run only when the set of keys changes: a key is added or deleted, or an array's length changes. A write that only changes a value no longer re-runs code that read only the keys.
- **BREAKING:** writing a property the value it already holds (by `===`) no longer notifies that property's observers.
- The four known-issue store tests move into `packages/core/tests/store.spec.ts` as plain tests.
- `docs/core/stores.md` documents both rules.

Effects run less often after this change, which is why it's marked breaking. Code that relied on a same-value write to force a re-run should write a new value or use a signal created with `isEqual: false`.

## Capabilities

### New Capabilities

- `stores`: which writes to a store notify which readers.

### Modified Capabilities

None.

## Impact

- `packages/core/src/store.ts` (`getSignalNode`, `trackSelf`, `setProperty`).
- Tests: `packages/core/tests/known-issues.spec.ts` (store sections removed), `store.spec.ts`.
- Docs: `docs/core/stores.md`.
- A `minor` changeset for `@signalis/core` (and, through the fixed group, `@signalis/react`) with **BREAKING** bullets.
