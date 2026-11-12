# Proposal

## Why

Two costs in how the graph stores dependency edges grow with usage instead of staying constant. Both are demonstrated in `packages/core/tests/known-issues.spec.ts`:

- **Repeated reads create duplicate edges.** A computation that reads the same signal three times in one run gets three entries in its sources and three in the signal's observers. Marking, validating and unlinking then walk every duplicate. A loop that reads a signal per item makes this as large as the loop.
- **Dropping a dependency scans the source's whole observer list.** Unlinking finds the observer with a linear scan, so a computation that stops reading a source with 1,000 observers makes 1,003 element reads. In a standalone measurement, toggling a conditional dependency was 60× slower on a source with 3,000 observers than on one with a single observer.

Values and run counts are unaffected; only the cost changes. Dynamic dependencies on shared, widely observed state (a current user, a theme, a selection) are exactly the case that pays for the second one.

## What Changes

- Repeated reads share one edge in the common case, when no nested computation reads the same source between them. Nested runs may still produce duplicates; values and run counts remain correct in either case.
- Subject to the benchmark gate, removing an edge takes constant time, independent of how many observers the source has. If the additional bookkeeping regresses the full benchmark, retain today's removal path and leave that known issue open.
- The order in which effects run is stated as unspecified everywhere, not only after a batch. Both changes can reorder a source's observer list when duplicates existed before, and observer order is what sets effect order.
- Each known-issue edge test moves into the regular core specs only when its optimization is retained. A rejected optimization keeps its expected-failure test and a recorded reason; no release note claims that case is fixed.

No public API changes.

## Capabilities

### New Capabilities

- `effects`: when effects run and how often, independent of batching.

### Modified Capabilities

None. The batch spec's statement that effect order after a batch is unspecified stays as it is. The new `effects` capability generalizes it.

## Impact

- `packages/core/src/state.ts` (`markDependency`), `utils.ts` (`reconcileSources`, `unlinkObservers`, `spliceWhenKnown`), `derived.ts` and `reaction.ts` (saving and restoring the run id around a run, new edge fields).
- Tests: `packages/core/tests/known-issues.spec.ts` (deleted only when both edge fixes are retained and the store change has removed its sections), `effect.spec.ts`, plus new edge tests.
- Memory: one number per source node for the read stamp; back-indices add one number per edge on each side only if that optimization survives measurement.
- A `patch` changeset for `@signalis/core` describing only the retained optimizations, with the nested-read limitation explicit.
