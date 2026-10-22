# Proposal

## Why

Inside `batch`, a write is not pushed to anything. It is parked on the written source as `_pendingStatus`, and every derived below it stays CLEAN even though its inputs changed. Two bugs follow, both reproduced on `origin/main` and on the released `@signalis/core@0.2.5`:

1. **Reads inside a batch go stale at depth two or more.** A read only checks the buffered marks of the reader's _direct_ sources, so a mark parked two or more hops up is invisible and the reader serves its cache. Which reads are wrong depends on read order: reading top-down delivers one hop per read and appears to work.
2. **Effects can run in the middle of a batch with partial state.** A mid-batch read of a derived delivers its source's mark to _every_ observer of that source, effects included, which schedules them. The next write in the same batch ends in `runReactions()`, which has no batch check, so the effect runs before the batch ends. This breaks the documented rule that effects run only after the outermost batch completes.

```ts
// Bug 1: reads `3`, want `11`
const s = createSignal(1);
const a = createDerived(() => s.value * 2);
const b = createDerived(() => a.value + 1);
b.value;
batch(() => {
  s.value = 5;
  b.value;
});

// Bug 2: the effect runs ['1,1,1', '5,2,1', '5,2,3'], want ['1,1,1', '5,2,3']
const s = createSignal(1), u = createSignal(1), v = createSignal(1);
const a = createDerived(() => s.value * 2);
createEffect(() => runs.push(`${s.value},${u.value},${v.value}`));
a.value;
batch(() => {
  s.value = 5;
  a.value;
  u.value = 2;
  v.value = 3;
});
```

Both come from the same design choice (buffer marks, patch one hop on read), so they are fixed together. A third bug, found while reviewing this change, has the same shape: `Derived#dispose()` marks the effects that read the disposed derived DIRTY but never runs them, so they run unconditionally at the next write of _any_ signal. `dispose` is unreleased, so it was never shipped. This is a correctness fix to a shipped behavior, so it is not gated on a benchmark win.

## What Changes

- **Reproduce first.** Add failing tests that prove both bugs on the current code and on `origin/main`'s `packages/core/src` before changing anything (see tasks).
- **Mark eagerly, defer only the reactions.** A write inside a batch marks its observers immediately, exactly as outside a batch (DIRTY on direct observers, STALE below them). Marking only changes statuses and schedules reactions. Running the scheduled reactions waits until the outermost batch ends, so observers still run once per batch.
- **Gate reaction runs on the batch.** `Signal#value`'s setter calls `runReactions()` only when no batch is open. `batchEnd` runs it when the count returns to 0.
- **Delete the buffering machinery.** `_pendingStatus` (on `Signal` and `Derived`), `STATE.pendingUpdates`, `runPendingUpdates`, `runPendingUpdate`, and both in-batch branches of `Derived#validate`. The clean-read fast path becomes `_status !== CLEAN`.
- **Mark dependents STALE in `Derived#dispose()`.** It marked them DIRTY and ran nothing, so the effects that read the disposed derived ran unconditionally at the next write of any signal. STALE makes them revalidate, so they run only if the derived's value changed, and they never run at all if they are disposed first (see design.md, decision 7).
- **Fix the overstated docs.** The batch paragraph in the `state.ts` overview, `Derived#dispose` ("batch-aware path"), and the two batch bullets in the unreleased `.changeset/faster-update-propagation.md`.

No public API change. **Observable change:** reads inside a batch are correct at any depth in any read order, and effects never run before the outermost batch ends.

## Capabilities

### New Capabilities

- `batch`: how `batch` groups writes. Reads inside a batch reflect earlier writes at any depth, and effects run only after the outermost batch ends, once per affected effect.

### Modified Capabilities

None. The project has no specs yet.

## Impact

- **Code:**
  - `packages/core/src/state.ts`: `markUpdates`, `batchEnd`, the buffering state and flush.
  - `packages/core/src/signal.ts`: the setter's `runReactions()` gate and `_pendingStatus`.
  - `packages/core/src/derived.ts`: `value`, `validate`, `dispose` (marks STALE), `_pendingStatus`.
- **React:** no `@signalis/react` source changes; `packages/react/tests/` gains batch tests. See design.md, decision 6.
- **Tests:** `packages/core/tests/batch.spec.ts` (new failing-first tests, plus the existing batch-delivery tests, which must pass unchanged) and the effect-ordering test in `effect.spec.ts` (extended with a mid-batch read case, captured before the source changes).
- **Performance:** repeated writes to one signal in a batch cost O(direct observers) each instead of O(1), and marking moves from the flush to write time. In-batch reads get cheaper. Measured with a baseline plus a drift run, as in `optimize-graph-hot-paths`.
- **Release:** `@signalis/core` patch, folded into the unreleased `faster-update-propagation` changeset, whose two batch bullets currently contradict this behavior. `@signalis/react` bumps in lockstep.
- **Stacking:** built on `main` after #70 merged. #70's iterative marking walk is what makes eager marking cheap.
