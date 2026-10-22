# Design

## Context

See proposal.md (Why) for the two bugs. The mechanism behind both, in `packages/core/src`:

- **A batched write marks nothing.** `markUpdates` (`state.ts`) records the mark on the written source as `_pendingStatus` and queues the source in `STATE.pendingUpdates`. Every derived below it stays CLEAN, although its inputs changed. That contradicts the definition of CLEAN in the `state.ts` overview ("reflects the current values of all of its sources") and breaks the invariant that a non-CLEAN derived has non-CLEAN observers.
- **A read patches one hop.** The in-batch branch of `Derived#validate` calls `runPendingUpdate` on the reader's _direct_ sources only. A mark parked two or more hops up is invisible, so the reader serves its cache. Reading top-down delivers one hop per read, which is why the result depends on read order.
- **An early delivery wakes every observer.** `runPendingUpdate(source)` marks _all_ of the source's observers, including reactions, which schedules them. `Signal#value`'s setter then calls `runReactions()` unconditionally, and `runReactions` has no batch check, so the next write inside the batch drains the queue and runs the effect with partial state. `Reaction#_commitSourceCollection` is the only other caller that checks `batchCount()` first.
- **How long.** The one-hop check dates from the #19 overhaul (`checkPendingUpdate`), and both bugs reproduce on the released `@signalis/core@0.2.5`. They are not regressions from #69 or #70.
- **Why it was buffered (history).** No commit message or comment says. The evidence is in the code. Before #19, `batch` only deferred `runEffects()`. In the #19 overhaul, `markUpdate` itself scheduled reactions, and the signal setter ended in an ungated `runReactions()`, so a mark delivered inside a batch ran effects immediately. Deferring the _mark_ was the way to keep effects from running mid-batch, and `checkPendingUpdate` (one hop, direct sources) was added so a mid-batch read still saw something. So buffering is a workaround for the missing gate on `runReactions()`, which this change adds. This is an inference, not a documented intent. The test most likely to encode a real constraint is "a big mess of interactions" (added in `4e10001`): it reads deriveds mid-batch after writes and expects every effect to run exactly twice. It must keep passing unchanged.
- **Callers of `runReactions`:** the signal setter (ungated), `batchEnd` (at count 0), and `_commitSourceCollection` (already gated). Nothing else runs reactions.
- **Marking runs no user code.** `Derived#markUpdate` and `Reaction#markUpdate` only change statuses and schedule reactions, so marking at write time cannot re-enter itself. The STALE walk is iterative (`Derived._markObserversStale`), so its cost no longer grows the call stack.

## Goals / Non-Goals

**Goals:**

- Keep the rule that makes batching worth having: a batch prevents cascades. Several writes are applied before anything reacts, so no effect ever observes a half-applied update.
- Reads inside a batch are correct at any depth and in any read order.
- No effect runs before the outermost batch ends, and each affected effect runs once after it.
- Less code, not more: the buffering machinery goes away.

**Non-Goals:**

- **Changing effect semantics outside a batch.** Unbatched writes behave exactly as today.
- **Iterative pull.** Reads of very deep graphs still recurse.
- **Changing what `dispose` means.** A disposed derived still drops its sources and recomputes on its next read.
- **Running effects at dispose time.** Decision 7 explains why not.
- **Net-change detection.** A signal written `1 → 2 → 1` in one batch still marks its observers, as it does today.
- **Preserving today's effect order for batches with mid-batch reads at all costs.** It is captured and checked (decision 4), but correct values come first.

## Decisions

### 1. Mark eagerly, defer only running the reactions

`markUpdates` always delivers its mark to the source's observers immediately, in a batch or not. Reactions that get marked are scheduled as usual (`scheduleReaction`), but nothing runs them until the outermost batch ends.

This restores the invariant that the whole design relies on: a derived below a changed source is not CLEAN, so every ordinary read validates it, with no special batch path. The STALE-then-DIRTY protocol already handles everything a batch read needs. It also means `hasInvalidatedSource` sees batched writes right away, which is correct.

Alternatives considered:

- **Validate sources recursively on an in-batch read of a CLEAN derived.** It fixes the stale reads, but every in-batch read after the first write costs O(ancestors) even when nothing changed, it keeps all of the buffering machinery, and it makes the early-delivery leak wider, since it delivers more marks early. Rejected.
- **Deliver marks transitively on a read (walk up, deliver at each hop).** Same cost and same machinery as above, and it needs a second queue to remember what to deliver. Rejected.
- **Keep buffering and run a full pass at the first in-batch read.** It turns the first read into the work the write would have done, but then the batch is half buffered and half eager, which is the hardest state to reason about. Rejected.

### 2. Gate `runReactions()` on the batch

`Signal#value`'s setter calls `runReactions()` only when `batchCount() === 0`. `batchEnd` decrements the count and, at 0, calls `runReactions()`; the delivery pass before it is no longer needed. With eager marking this gate is load-bearing: reactions are scheduled on every batched write, so without it every write would run them.

### 3. What is deleted and what stays

- **Deleted:** `_pendingStatus` on `Signal` and `Derived`; `STATE.pendingUpdates`, `runPendingUpdates` and `runPendingUpdate`; both in-batch branches of `Derived#validate`. `markUpdates` becomes one line. The clean-read fast path in `Derived#value` becomes `_status !== CLEAN`, because a CLEAN derived is now always current, in a batch or not.
- **Unchanged:** `batch`'s `try/finally`; both `_commitSourceCollection` batch gates; `hasInvalidatedSource`; the STALE walk; the reaction queue.
- **Comments to correct:** the batch paragraph of the `state.ts` overview, `Derived#dispose` ("batch-aware path"), and the names of batch tests that mention buffering.

### 4. Effect order is checked, not assumed

Batches without mid-batch reads schedule reactions in the same order as today: the flush delivered marks in first-write order, and eager marking marks at the first write, and a repeated write finds its observers already marked. Batches with mid-batch reads may change order, because early delivery used to schedule reactions at the read.

Before touching source, extend the effect-ordering test with a mid-batch read case and capture today's order. If the order moves, that is a deliberate, documented change, not an accident; if it doesn't, the test stays unchanged.

**Outcome.** The unbatched and batched ordering test without mid-batch reads is unchanged. The new test with mid-batch reads (with an `end of batch` marker logged at the end of each batch) did change, and only because effects stopped running mid-batch: on the old code `fx2:5` and `fx3:2:8` ran before the first marker, and `fx4:3` and `fx1:5` before the third, and `fx3:2:8` ran twice in the first batch. Now every `fx` entry follows its batch's marker and each effect runs once per batch. The recompute order inside each batch follows the usual rules, so the list was re-captured from the new implementation. The three batch-delivery tests in `batch.spec.ts` must pass unchanged either way.

### 5. Prove the bugs first, on old code

The first task writes the failing tests and runs them against the current source and against `origin/main`'s `packages/core/src`. The tests are synchronous and deterministic, so one red run is proof. Tests that already pass today (mixed direct and indirect sources, top-down reads, first-ever read inside a batch) go in as guards and must stay green.

### 6. The React package needs no source change, but needs tests

`@signalis/react` never calls `batch`, and none of its tests use it. Its bindings sit on the same graph:

- **`reactor`:** a `Reaction` whose compute calls `forceUpdate`. Under this change that reaction is scheduled at the first batched write and runs at the batch end, once, as an effect does. Today a mid-batch read can run it early. That is mostly harmless for rendering, since React renders later and reads final values, but it is still wrong for `useSignalEffect`, which runs synchronously.
- **`useDerived` and `reactor` deferred collection** (`_beginSourceCollection` / `_commitSourceCollection`): a derived or reaction links its sources after commit and then asks `hasInvalidatedSource` whether any source left CLEAN in between. With buffering, a write inside an open batch leaves every derived source CLEAN, so a commit that lands inside a batch would miss the invalidation. Eager marking makes that check see batched writes, which is the behavior its comment already assumes.
- **A spike** (not committed, reverted) applying only eager marking plus the setter gate passed all 104 core tests and all 39 React tests, including the unchanged ordering and batch-delivery tests, and fixed every repro in the proposal.

Add tests in `packages/react/tests/`: a `reactor` component re-renders once for a multi-write `batch`, and a component reading a `useDerived` value two levels below a signal sees the batched write (see tasks 1.5 and 3.5).

### 7. `Derived#dispose()` marks dependents STALE and does not run them

`dispose` marked its observers DIRTY through `markUpdates`, which only schedules reactions, and then nothing ran them. An effect reading a disposed derived sat in the queue, DIRTY, until the next write of any signal, and then ran unconditionally. In React, a `useDerived` deps change produced a spurious render at that next unrelated write.

The first fix tried was to run the reactions at the end of `dispose`. A probe showed that was worse: React cleans up the derived before it cleans up an effect declared after it (`useDerived` then `useSignalEffect`), so the effect re-ran once with an unchanged value on every unmount and every deps change, before its own disposal. An effect that makes an API call would fire it for nothing. The old behavior never did, because the effect was disposed before the queue ran.

The fix is smaller: mark observers **STALE instead of DIRTY** and leave them scheduled. (DIRTY was only needed while marks were buffered in a batch; see decision 1.) A STALE observer revalidates its sources when the queue next runs. That recomputes the disposed derived and resubscribes it, and the observer runs only if the derived's value actually changed. Consequences:

| Situation | Result |
| --- | --- |
| Effect keeps reading a disposed derived; value unchanged | Does not run; the derived is resubscribed at the next validation |
| An upstream signal changes the derived's value | Runs, with the new value (the write's own `runReactions` validates it) |
| The effect is disposed right after the derived (unmount, deps change) | Never runs: no API call |
| `useDerived` deps change | The reactor's reaction relinks to the new derived before the queue runs, so no spurious render |
| Dispose inside a batch | Nothing special; the scheduled reactions validate at the batch end |

Alternative rejected: running the reactions at the end of `dispose` (DIRTY or STALE). It fires effects for nothing in the unmount order above, and with STALE it also pulls the old derived through a reaction that still lists it, which resurrects and re-links it to its upstream signals, leaking one derived per deps change.

## Risks / Trade-offs

- **[Repeated batched writes cost more]** → A write to a signal with many direct observers now walks them each time, instead of O(1). Every later write finds them already marked and stops at that first level. Measure it with a baseline run plus a drift run. The bench writes inside a batch for every iteration, so it exercises this path.
- **[Marking moves from the flush to write time]** → Net work is the same or less, because each node is marked once either way, and in-batch reads no longer pay for delivery. The bench decides between this and the rejected alternatives; it does not decide whether to fix a correctness bug.
- **[Effect order changes for batches with mid-batch reads]** → Decision 4: capture first, then document any change.
- **[`update()` (store) users]** → `update` runs its recipe in a `batch`. Reads of deriveds inside a recipe become correct, with no change needed there. Add a test, since store users never call `batch` themselves.
- **[Throw inside a batch]** → `batch`'s `finally` still runs `batchEnd`, which now just runs the scheduled reactions. Nothing buffered can be stranded, which removes the failure mode where a half-delivered queue left observers un-notified.

## Migration Plan

No API change. It ships as a `@signalis/core` patch by revising the two batch bullets in the unreleased `.changeset/faster-update-propagation.md`, which currently contradict the behavior (one says writes no longer allocate per write; the other says reads pick up earlier changes, which is true only one hop down). Rollback is a plain revert.
