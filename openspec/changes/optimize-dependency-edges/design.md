# Design

## Context

- **Recording reads.** `markDependency` compares each read with the running computation's previous sources in order: while they match, it only advances an index, and from the first mismatch on, it pushes reads into a new context. It doesn't check whether this run already read the source, so a repeated read either advances past a stale slot or pushes a duplicate.
- **Linking.** `reconcileSources` unlinks the old sources from the divergence index on, writes the new ones in, and pushes the computation onto each new source's `_observers`.
- **Unlinking.** `unlinkObservers` calls `spliceWhenKnown` for each source, which finds the computation in `_observers` with `findIndex` (allocating a closure) and then swaps the last entry into its slot and pops. Swap-and-pop is what makes observer order, and therefore effect order, depend on unlink history.
- **Order is pinned by a test.** `effect.spec.ts` "effects and derived computations run in a stable order through a branching graph" records the current order. The batch spec already says effect order after a batch is unspecified. The new `effects` spec extends that to all writes.
- **Precedent.** `optimize-graph-hot-paths` rejected linked-list edges (slower for computations with many dependencies) and dropped a change whose micro-benchmark gain didn't survive the full benchmark. Both rules apply here.

## Goals / Non-Goals

**Goals:**

- One edge per source per run, in the common case.
- Constant-time edge removal.
- Values, recompute counts and effect counts unchanged. The order test in `effect.spec.ts` keeps passing unchanged as a regression guard.

**Non-Goals:**

- Switching to linked-list edges.
- Guaranteeing no duplicates in every nesting pattern (see Decision 1).
- Shrinking per-node memory elsewhere (`Derived`'s field count). That needs a creation and heap benchmark first.

## Decisions

### 1. A read stamp per run

Every run of a computation (`Derived#compute`, `Reaction#compute`, `Reaction#trap`) gets a fresh run id from a global counter. It's saved and restored together with the running computation and context, so an outer computation gets its own id back after a nested one finishes. A source records the id of the last run that read it. `markDependency` returns early when the source's stamp equals the current run id, before the index comparison, and stamps it otherwise.

- **The check has to come before the index comparison.** Otherwise the second read compares itself with the next previous source, finds a mismatch, and starts a new context every run: worse than today.
- **Nested runs:** if a nested computation reads the same source between two reads by the outer one, it overwrites the stamp, and the outer computation's second read links a duplicate. That's exactly today's behavior, and every path already handles duplicates correctly, so this is a missed optimization, not a hazard.
- **Untracked reads** return before stamping, as they return before recording today.
- **Alternative rejected: a `Set` per run.** It allocates on every run.
- **Alternative rejected: checking only the previous source.** It catches only back-to-back repeats.
- **Prototype:** a prototype of the stamp alone passed the full suite (including the order test) and reduced the duplicate-read test from 3 edges to 1.

### 2. Back-indexed edges

Each computation keeps `_sourceSlots`, parallel to `_sources`: for source `i`, the computation's position in that source's `_observers`. Each source keeps `_observerSlots`, parallel to `_observers`: for observer `j`, that source's position in the observer's `_sources`.

- **Removing** the edge to source `i` reads the position from `_sourceSlots[i]`, moves the source's last observer into that position, updates that moved observer's `_sourceSlots` entry through `_observerSlots`, and pops both arrays. No scan, no closure.
- **Order is preserved.** Removal is still swap-and-pop on `_observers`, so without duplicates the resulting observer order is the same as today's. With duplicates, the slot that's removed can differ from the first match `findIndex` returns, which is why the `effects` spec states order is unspecified.
- **`reconcileSources`** writes both slot arrays wherever it writes `_sources` or pushes onto `_observers`, including the partial path that keeps leading sources.
- **Alternative rejected: linked-list edges.** Measured slower in `optimize-graph-hot-paths`.
- **Alternative rejected: a `Map` from observer to position per source.** It allocates and hashes on every link.

### 3. Land and measure them separately

Decision 1 ships on its own. Decision 2 is kept only if the full benchmark shows no scenario regressing outside its run-to-run spread, the same rule `optimize-graph-hot-paths` used. The fan-out cost it fixes isn't in the benchmark's graphs, so its gain is shown by the known-issue test (element reads) and a fan-out timing script, while the benchmark guards against regressions.

## Risks / Trade-offs

- **[Slot bookkeeping goes out of sync]** A wrong slot corrupts the graph silently. → Add a test-only invariant check that walks a graph and verifies every slot pairs up, and run it after the dynamic-dependency, dispose, deferred-collection and error tests. Keep the `assert` in the removal path.
- **[Per-edge memory and link cost]** Two numbers per edge, and one more write on each link. → The Decision 3 benchmark gate. Drop Decision 2 if it fails.
- **[Effect order changes in code with duplicate edges]** → Allowed by the new spec. The order test in `effect.spec.ts` must pass unchanged.
- **[Run-id counter overflow]** → A plain number increments safely for longer than any process will run (2^53).

## Migration Plan

No API change. Ship as a `patch` changeset for `@signalis/core`. Each decision lands as its own commit, so either can be reverted alone.
