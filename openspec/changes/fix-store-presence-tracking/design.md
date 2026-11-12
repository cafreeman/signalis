# Design

## Context

See `proposal.md` for motivation and `specs/store-presence/spec.md` for the observable contract. Current source is the reviewed `fix-store-notifications` implementation in PR #75, not the earlier baseline:

- `handler.has` delegates to `get`, then returns `prop in target`. `get` reads property values, skips initial signals for functions/getters, and may execute getters or wrap nested values.
- `getSignalNode` uses default `===` equality. `setProperty` represents removal by deleting the raw key and writing undefined to its value signal. Presence cannot be recovered from that signal.
- `$SELF` is a reliable structural notifier after the reviewed fix, but carries no per-key boolean. `ownKeys` exposes raw own keys, including existing non-enumerable internal symbols.
- `update` batches each recipe. Signal writes invalidate immediately; effects flush after the outermost batch. Main batch/error-handling specs and the existing derived-inside-recipe store test apply unchanged.

The investigation reproduced the defects on both original and reviewed builds. The separate nullish factory bug explains some baseline suppression, but repairing it is neither a presence fix nor a dependency of this design.

## Goals / Non-Goals

**Goals:** separate values, enumeration, and key-local prototype-chain presence; no getter evaluation for presence; correct derived reads immediately after supported writes; bounded sparse-array shrink work; no additional observable own metadata keys.

**Non-Goals:** reactive `Object.hasOwn`/descriptor queries, `defineProperty` support, raw/prototype mutations, general class/custom-prototype nesting support, inherited value-cache repair, index-value cache repair after truncation, transaction-net equality, graph/React redesign, or changes to public signatures. Private stable prototypes can be used in root compatibility tests without promising arbitrary prototype reactivity.

## Decisions

### 1. Private, collision-safe per-key boolean storage

Use a private `WeakMap<StoreNode, Map<string | symbol, Signal<boolean>>>` keyed by raw targets. Lazily allocate the map and a `createSignal(Reflect.has(target, key))` entry when ordinary presence is read. Ordinary writes consult existing entries only; they must not create presence nodes for unobserved keys.

This avoids collisions with `__proto__`, `constructor`, `toString`, and symbol keys, without changing the existing value-node dictionary or adding an own symbol visible to `Reflect.ownKeys`. The weak root does not keep an otherwise unreachable store alive. Entries can remain for the raw target's lifetime, as value nodes do; disposing computations still removes observer edges through the existing graph.

Normalize numeric `PropertyKey` inputs to their string form before presence-map lookup. Proxy traps already receive normalized strings/symbols, but internal `setProperty` callers include numeric array indices. Number `-0` becomes property name `"0"`; string `"-0"` remains a distinct ordinary property.

**Rejected:** reading `$SELF` gives coarse invalidation on unrelated structural changes; retaining `get` as well still evaluates getters and reruns on value-only writes. Restoring never-equal value signals would violate the approved value contract. A new raw-target symbol would change observable own-key output.

### 2. Presence reads never route through values

Retain the existing explicit `has` handling for `$STOREPROXY`, `$RAW`, and `$NODES`. For ordinary keys, read the boolean presence node, using raw `Reflect.has` rather than property access. Preserve the current results for every internal symbol, including `$SELF`, which must not become an additional always-true virtual key.

No value signal, property getter, function invocation, or nested wrapping is needed to establish this dependency. `Object.hasOwn` continues to use its distinct descriptor path; do not make descriptor access reactive as a side effect of this change.

### 3. Reconcile immediately after mutation

In `setProperty`, capture old actual array length, perform the existing assignment/deletion, then update an already-observed entry for the normalized written key with `Reflect.has(target, key)`. Perform any shrink reconciliation in the same mutation path. Keep this bookkeeping before existing value/key notification writes so no notification path can expose obsolete presence state.

Boolean `===` equality suppresses updates when only values or own-shadow status changed. The resulting boolean must come from the actual post-mutation target: deletion can reveal an inherited key. Do not infer presence from the assigned value or from `Object.hasOwn`.

No ordinary-write scan of all presence keys is needed. Keep the existing value signal and `$SELF` rules intact. Do not defer presence reconciliation until the recipe returns: a primed derived read between two writes must observe each earlier mutation.

### 4. Array shrink scans allocated presence keys, not the removed range

When actual length shrinks from `oldLength` to `newLength`, inspect the allocated presence map, if any. For each tracked canonical index in `[newLength, oldLength)`, write its post-mutation `Reflect.has` boolean. Do not assume deletion implies absence when a stable prototype still supplies that index.

A canonical array-index key is a string whose numeric value is an integer `n`, with `0 <= n < 2**32 - 1`, and `String(n) === key`. Guard symbols before conversion. Thus `"0"` and `"4294967294"` qualify; `"-0"`, `"01"`, `"1.0"`, `"1e0"`, negative/fractional forms, and `"4294967295"` do not. Do not use `parseInt` or signed-bitwise coercion.

The shrink path costs O(P) classification for P allocated presence entries, with raw presence checks only for candidate indices. It must not iterate over every removed integer, enumerate all raw keys, or scan presence entries on ordinary value writes/array growth. Large sparse arrays remain bounded by observation count, not length. Truncation updates presence only; stale index-value caches remain a separate issue.

For huge sparse-array fixtures, wrap a small array first, then grow its length and assign the boundary indices through `update`. Current `unwrap` traverses initial array length, so passing an already huge array to `createStore` would exercise an unrelated existing initialization cost. Do not spread or value-iterate those fixtures, and do not widen this change to optimize initial unwrapping.

### 5. Preserve existing batching and error behavior

A direct presence effect can be queued by a transient `true -> false -> true` and run once after the batch with final `true`. This is not a defect: existing scheduling deduplicates work, not transaction-net changes. A downstream effect behind a derived can additionally be suppressed by derived equality; tests must distinguish direct and derived dependency shapes.

Prime derived checks before recipes; after deletion/re-addition and after array shrink, read them inside the recipe and assert current booleans. Assert direct effects remain unchanged until the outermost batch closes. If a recipe throws after a completed supported mutation, retain that mutation, propagate the recipe error, and flush effects at normal outer-batch completion. No new exception-handling mechanism is introduced.

### 6. Verification and performance evidence

Add ordinary tests in `packages/core/tests/store.spec.ts` with `.js` source imports, fresh stores, isolated presence/value/key readers, complete inside-effect snapshot histories, and disposal. Diagnose intended red assertions before editing production code; getter probes must distinguish wrong getter evaluation from unrelated setup errors. Keep the approved value/key tests unchanged, especially the undefined-removal histories.

Cover all spec scenarios, including multiple `in`/`Reflect.has` readers, deriveds, functions, getters, nested replacements, symbols, numeric normalization, collision-prone names, stable inherited keys, internal-symbol results, and sparse array boundaries. Avoid observer-array implementation details that would couple these tests to `optimize-dependency-edges`.

Before production edits, capture a bounded presence workload in fresh processes: repeated presence reads, ordinary writes with zero/few/many observed presence keys, and huge sparse-array shrink with few observed indices. Record source/build identity, settings, correctness counters, wall times, and any measured allocation method. Repeat baseline/fixed builds as adjacent alternating pairs after implementation; use process-level summaries, not pooled samples as independent runs. Different semantics can intentionally change effect counts, so report those counts rather than calling all work equivalent. If overhead exceeds observed process variation or shrink cost scales with numeric array length, pause for a design decision, not a weaker presence contract. Existing graph benchmarks are not direct evidence for this workload.

## Risks / Trade-offs

- **[Missed implicitly deleted array keys]** -> Canonical-index boundary tests, affected/unaffected observers, inherited indices, and immediate derived reads during shrink.
- **[More retained per-key metadata]** -> Lazy weak-root storage; writes without presence readers allocate no presence entries. Measure the bounded workload rather than adding unrelated read-allocation optimization.
- **[Presence-only runs become less frequent]** -> Explicit minor/BREAKING release and migrations; code needing values must read them.
- **[Prototype and virtual-key differences]** -> Preserve prototype-chain booleans and existing internal-symbol special cases; do not claim reactive prototype mutation or repair inherited value caches.
- **[Storage bookkeeping changes observable keys]** -> No new own metadata symbol; retain full existing `Reflect.ownKeys` expectations.
- **[Confusing batch equality with net equality]** -> Test transient direct effects separately from derived-result equality and document the scheduler's existing rule.

## Migration Plan

Implement on top of the reviewed store-notifications behavior; leave PR #75 unchanged. Add the independent `store-presence` capability so planning/archival does not depend on whether its `stores` capability has already been archived. `fix-nullish-signal-equality` is independent. `optimize-dependency-edges` may change graph internals, so keep public tests behavioral and rerun them after integration.

During implementation, document `in`/`Reflect.has` precision and the `Object.hasOwn` boundary in `docs/core/stores.md`. Add a core `minor` changeset with **BREAKING** bullets: presence-only reads no longer act as value subscriptions, and presence checks no longer evaluate getters. Migrate to explicit value/getter reads or key enumeration as appropriate. Core/react release in lockstep. Rollback is a normal revert; no persisted state or data migration is involved.
