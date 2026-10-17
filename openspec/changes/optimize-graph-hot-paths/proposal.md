# Proposal

## Why

Benchmarking `@signalis/core` against alien-signals and Preact Signals showed that most of the remaining gap comes from three implementation costs on hot paths, not from the graph's design. Each was measured in isolation on a scratch copy of core. Together they make Signalis faster than or tied with alien-signals in five of the six benchmark scenarios, with identical computed counts, effect counts, and verified sums.

| Scenario          | Current (ms) | With fixes (ms) | alien-signals | Preact |
| ----------------- | ------------ | --------------- | ------------- | ------ |
| simple component  | 203.9        | 154.4           | 146.5         | 166.0  |
| dynamic component | 113.3        | 101.5           | 118.8         | 126.8  |
| large web app     | 271.2        | 233.0           | 241.1         | 252.4  |
| wide dense        | 271.6        | 214.5           | 349.7         | 372.5  |
| deep              | 101.2        | 87.1            | 85.9          | 107.1  |
| very dynamic      | 186.8        | 170.7           | 203.6         | 209.9  |

## What Changes

- **Batch queue keeps its storage between batches.** The end-of-batch flush clears the pending-source queue with `pending.length = 0`, which makes V8 drop the array's backing store, so the first write of every batch reallocates it. The queue becomes a fixed array with a separate count, cleared slot by slot as it's flushed. Measured: `batch(write) → effect` goes from 63.8 ns to 37.5 ns.
- **STALE marking walks the graph with a loop instead of recursion.** `Derived#markUpdate` recursively marks observers STALE, one non-inlinable call per node. An iterative depth-first walk with an explicit stack visits nodes, and therefore schedules reactions, in the same order. Measured on a 1000-node chain: 41.0 µs to 35.9 µs per write.
- **Reading a clean derived skips `validate()`.** `Derived#value` always calls `validate()`, which is too large for V8 to inline, even when the derived is CLEAN and no batch is open (where `validate()` does nothing). The getter checks those two conditions inline first. Measured on the same chain: 35.9 µs to 31.0 µs (alien-signals: 28.8 µs).

There are no API, behavior, or ordering changes. All three keep the observable semantics: values, recompute counts, effect counts, and effect execution order.

## Capabilities

### New Capabilities

None. The project has no specs yet, and this change alters no externally observable behavior, so it opts out of spec deltas (`skip_specs: true`).

### Modified Capabilities

None.

## Impact

- **Code:**
  - `packages/core/src/state.ts`: the pending-update queue and the flush.
  - `packages/core/src/derived.ts`: `markUpdate`, the `value` getter, and the iterative propagation helper.
  - The `_status` field may need to become `@internal` instead of `private`, so the propagation loop can read and write other nodes' statuses.
- **Tests:** a regression test for propagation and scheduling order through a branching graph, in `packages/core/tests/`.
- **Docs:** source comments describing how propagation and batching work today (per the repo's documentation convention).
- **Release:** `@signalis/core` patch. This fits the existing pending changeset `.changeset/faster-update-propagation.md`, which covers related, still-uncommitted propagation work, so it extends that changeset rather than adding a new one. `@signalis/react` bumps in lockstep through the fixed release group.
- **Dependencies:** none.
