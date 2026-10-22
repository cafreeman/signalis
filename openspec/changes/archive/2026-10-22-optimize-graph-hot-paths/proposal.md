# Proposal

## Why

Benchmarking `@signalis/core` against alien-signals and Preact Signals showed that most of the remaining gap comes from implementation costs on hot paths, not from the graph's design. Each was measured in isolation on a scratch copy of core. Two of them hold up on the full benchmark and are implemented here; the third, the batch queue, doesn't (see below). Together the two make Signalis faster than alien-signals in four of the six benchmark scenarios (it stays behind on simple component and deep), with identical computed counts, effect counts, and verified sums.

| Scenario          | Current (ms) | With fixes (ms) | alien-signals | Preact |
| ----------------- | ------------ | --------------- | ------------- | ------ |
| simple component  | 193.6        | 175.5           | 138.1         | 159.3  |
| dynamic component | 113.4        | 100.3           | 108.5         | 119.0  |
| large web app     | 227.8        | 203.9           | 226.7         | 225.8  |
| wide dense        | 252.7        | 219.0           | 309.3         | 351.6  |
| deep              | 99.6         | 85.6            | 79.9          | 93.1   |
| very dynamic      | 176.1        | 160.2           | 179.9         | 204.8  |

## What Changes

The pending-update queue is not changed: a fixed array with a separate count measured faster in isolation (`batch(write) → effect`, 63.8 ns to 37.5 ns) but slower on large web app (+6%) and wide dense (+5%) once run on the full benchmark, so it was dropped. See design.md, decision 1.

- **STALE marking walks the graph with a loop instead of recursion.** `Derived#markUpdate` recursively marks observers STALE, one non-inlinable call per node. An iterative depth-first walk with an explicit stack visits nodes, and therefore schedules reactions, in the same order. Measured on a 1000-node chain: 41.0 µs to 35.9 µs per write.
- **Reading a clean derived skips `validate()`.** `Derived#value` always calls `validate()`, which is too large for V8 to inline, even when the derived is CLEAN and no batch is open (where `validate()` does nothing). The getter checks those two conditions inline first. Measured on the same chain: 35.9 µs to 31.0 µs (alien-signals: 28.8 µs).

There are no API or ordering changes. Both keep the observable semantics: values, recompute counts, effect counts, and effect execution order. The one edge difference: a write that marks a graph deeper than the call stack allows used to throw a `RangeError` from the recursive marking, and now doesn't. Reads of such a graph still recurse (see Non-Goals in design.md).

The "Current" column is a full run of the unchanged core, and "With fixes" is the same run configuration on the implemented change (Apple M4 Pro, node 24, median of 10). The alien-signals and Preact columns come from the "With fixes" run. Every cell reported `ok`, and all six scenarios improved by 9% to 14%, outside their min/max spread. A second run of the unchanged core came within 1% of the first on four scenarios and within 6% on the other two, so the improvements are well outside run-to-run drift.

## Capabilities

### New Capabilities

None. The project has no specs yet, and this change alters no externally observable behavior, so it opts out of spec deltas (`skip_specs: true`).

### Modified Capabilities

None.

## Impact

- **Code:**
  - `packages/core/src/state.ts`: the "How updates flow through the graph" overview comment only.
  - `packages/core/src/derived.ts`: `markUpdate`, the `value` getter, and the iterative propagation helper.
  - `_status` stays `private`. The propagation loop is a `private static` method on `Derived`, so it can read and write other nodes' statuses without widening the type surface.
- **Tests:** a regression test for propagation and scheduling order through a branching graph, plus tests for deep chains, the DIRTY guard, clean and in-batch reads, and batch delivery, in `packages/core/tests/`.
- **Docs:** source comments describing how propagation and batching work today (per the repo's documentation convention).
- **Release:** `@signalis/core` patch. This fits the existing changeset `.changeset/faster-update-propagation.md`, which covers related propagation work that is committed but not yet released, so it extends that changeset if it's still pending at release time, and otherwise adds a new one. `@signalis/react` bumps in lockstep through the fixed release group.
- **Dependencies:** none.
