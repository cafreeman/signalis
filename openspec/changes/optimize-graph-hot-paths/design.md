# Design

## Context

See proposal.md (Why) for the measurements. The relevant current code:

- **Batch buffering (`packages/core/src/state.ts`).**
  - `markUpdates` buffers a write made inside a batch by recording the mark on the source (`_pendingStatus`) and pushing the source onto `STATE.pendingUpdates`, once per source.
  - `runPendingUpdates` delivers the marks and then truncates the array with `pending.length = 0`.
  - `runPendingUpdate` can also deliver one source's mark early, when a derived is read mid-batch. It resets that source to CLEAN, so the end-of-batch pass skips it.
- **STALE marking (`packages/core/src/derived.ts`).** `Derived#markUpdate` raises the node's status. Only when the node leaves CLEAN does it loop over `_observers`, calling `markUpdate(STALE)` on each one. That recurses through derived observers. A reaction observer's `markUpdate` just schedules it.
  - **Ordering constraint:** the recursion visits nodes depth-first and pre-order. Reactions are scheduled in that order, and `runReactions` drains the queue LIFO, so this visit order sets effect execution order. That order is observable and must not change.
- **Reads (`Derived#value`).** The getter calls `markDependency(this)` and then always calls `validate()`. On a CLEAN derived outside a batch, `validate()` falls through every branch and only rewrites `_status = CLEAN`. `_status` is `private`.
- **Re-entrancy.** Delivering marks never runs user code. `Reaction#markUpdate` only schedules, and computations run later, from `validate`/`runReactions`. So neither the flush nor STALE propagation can re-enter itself.

## Goals / Non-Goals

**Goals:**

- Remove the three measured costs while keeping values, recompute counts, effect counts and effect execution order identical.
- Keep `_status` and other internals off the public type surface.

**Non-Goals:**

- **Iterative pull.** Making `Derived#validate` iterative (as alien-signals' `checkDirty` is) is a larger rewrite. Deep graphs still recurse on reads.
- **Linked-list dependency edges.** Arrays measured faster than linked lists for nodes with many dependencies (83 ns vs 116 ns for a computed with 10 dependencies).
- **Restructuring the batch model.** For example, marking immediately and deferring only the reactions, as alien-signals does.
- **Changing the reaction queue (`pop()`) or the effect wrapper (`compute` → `trap`).** Both were measured, and neither changed results beyond noise.
- **Applying the clean-read fast path inside `validate`'s own source loop.** Possible later, but not measured yet.

## Decisions

### 1. Pending queue: fixed array plus a count

`STATE.pendingUpdates` stays an array, and a new `STATE.pendingCount` tracks its live length.

- **Queueing:** `markUpdates` writes `pendingUpdates[pendingCount++] = source`.
- **Flushing:** `runPendingUpdates` walks indices up to the live count, sets each slot to `undefined` before delivering it (so the queue doesn't keep sources alive), then resets the count to 0. The array's backing store stays allocated across batches.
- **Order:** delivery order stays the order in which sources were first written.

Alternatives considered:

- **`pending.length = 0` (current).** V8 frees the backing store, so the next batch's first push reallocates it. This was 35% of a batch-only profile.
- **`pending.splice(0)`.** Also releases the storage. It measured 52.5 ns, against 37.5 ns for the counter.
- **An intrusive linked list (a `_nextPending` field on every source, as Preact does).** It adds a field to every signal and derived, and it's harder to keep in write order with early delivery. It gives no measured benefit over the counter.

### 2. Iterative STALE propagation with preserved visit order

When a derived first leaves CLEAN, `markUpdate` hands its observer array to a propagation routine. That routine runs a loop over an explicit stack of `(observers array, next index)` frames:

- **A CLEAN derived observer:** set it to STALE. If it has observers, push the current frame and descend into its observers immediately. This is exactly the recursion's pre-order.
- **A derived observer that isn't CLEAN:** skip it, as the recursion does through its `_status < status` guard.
- **A reaction observer:** call `markUpdate(STALE)`, which schedules it.

The stack frames live in two module-level arrays (observer arrays and indices). They're reused across calls and grow only to the graph's depth, so propagation allocates nothing. Slots are cleared as frames are popped. Reusing module-level stacks is safe because propagation can't re-enter (see Context).

- **How the routine tells derived observers from reactions:** with `instanceof Derived`, a single monomorphic check. The alternative was a new polymorphic method on both classes.
- **Where the routine lives:** as a `private static` method on `Derived`. TypeScript lets a class's static methods read and write the `private _status` of any instance, so `_status` stays private and the public declaration surface doesn't grow.
- **Alternative rejected:** an exported helper in `state.ts`/`utils.ts` would need `_status` made `@internal` public, and `utils.ts` would need to import `Derived` (a cycle).

Alternative considered: a work list (push all observers, pop LIFO) instead of index frames. It's simpler, but it visits siblings before descendants, which changes the order reactions are scheduled in, and therefore effect order. Rejected.

### 3. Clean-read fast path in the getter

`Derived#value` becomes: `markDependency(this)`, then call `validate()` only if `_status !== CLEAN || batchCount() !== 0`, then return the cached value.

- **Why it's equivalent:** this is exactly the case in which `validate()` would do nothing.
- **Why it's fast:** the check is small enough for V8 to inline into callers, whereas `validate()` isn't.
- **What stays the same:** `validate()` itself is unchanged, because other paths (a STALE computation validating its sources, reactions) still call it directly.

Alternative considered: restructuring `validate()` so that its CLEAN path returns first. That still pays for the call when `validate()` isn't inlined, which is what the profile showed.

## Risks / Trade-offs

- **[Effect order silently changes]** → Before touching propagation, add a test that records the order in which effects run and nodes recompute for a branching graph (several reactions under shared deriveds, siblings at multiple depths), and capture the expected order from the current implementation. The test must pass unchanged afterwards. The bench's verified sums and counts give a second check.
- **[Re-entrancy assumption breaks later]** (for example, if `Reaction#markUpdate` someday runs code synchronously) → Document the assumption where the shared stacks are declared. Keep `markUpdate` on reactions schedule-only.
- **[Queue or stack slots retaining nodes]** → Clear each queue slot and stack slot as it's consumed, so a flushed batch or finished propagation holds no references.
- **[Gains are V8- and machine-specific]** → Re-run the full `pnpm bench` after implementation and compare against the run recorded in proposal.md. Keep a fix only if it holds up there.
- **[`instanceof` across duplicate module copies]** → Not a concern: `@signalis/react` must not bundle core (already enforced), so there is one `Derived` class per graph.

## Migration Plan

There's no API change, so the change ships as a `@signalis/core` patch by extending the pending changeset `.changeset/faster-update-propagation.md`. Rollback is a plain revert, since nothing persists.
