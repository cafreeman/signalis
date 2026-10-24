# Design

## Context

Deferred source collection: during a render, `reactor`'s reaction and every `useDerived` derived record what they read instead of linking it (`_beginSourceCollection`, then `trap`/`compute` store a pending context). After commit, a passive effect calls `_commitSourceCollection`, which links the pending sources and then calls `hasInvalidatedSource` on the newly linked ones (the leading sources were linked all along, so writes to them already notified the computation).

`hasInvalidatedSource` asks each new source `_isClean()`. A derived answers from its status, but `Signal#_isClean()` always returns `true`, so a signal written between render and commit is never caught. Two more gaps sit next to that one:

- When `Reaction#_commitSourceCollection` finds a stale source, it marks itself STALE. A STALE computation validates its sources, but validating a signal does nothing, so a reaction whose only changed source is a signal would stay STALE and never run.
- `Derived#_commitSourceCollection` marks itself STALE but never drains the reaction queue, so a reaction it schedules waits for some unrelated write.

`reactor`'s mount effect calls `forceUpdate()` unconditionally (added in 2e84e27 to catch writes from ancestor layout effects). That covers signals a component reads directly on mount, at the cost of a second render for every component. It doesn't cover `useDerived`, because the second render reads the derived's cached value, and it doesn't cover re-renders at all.

Hook order matters at commit: `reactor` registers its two effects before it calls the component, so they run before any effect the component registers, `useDerived`'s included. On mount, the reaction therefore links to a `useDerived` derived before that derived links to its own sources.

## Goals / Non-Goals

**Goals:**

- Make the commit-time check see signals written after the render that read them, for reactions and deriveds alike.
- Remove the unconditional mount render, keeping the Strict Mode remount render.
- Keep behavior pinned by `reactor.spec.tsx` unchanged: writes a component makes during its own render, abandoned renders leaving no subscriptions, renders per batch.

**Non-Goals:**

- Changing when sources are collected or linked.
- Changing core behavior outside deferred collection. Reactions and deriveds that aren't collecting never call the changed code.
- Detecting writes made during the render *before* the read (see Decision 2): a write the render saw is still counted, which only costs a render.

## Decisions

### 1. A global write counter, and a per-signal stamp

`State` gets a counter. A signal write that changes the value increments it and stores the new count on the signal (`_writtenAt`). A collecting computation records the counter when collection begins. At commit, a newly linked signal source whose `_writtenAt` is greater than the recorded count was written after the render started.

- **Why a stamp per signal, not just the global counter:** comparing only the global counter would re-render a component for any write anywhere in the app between its render and its commit. That's correct but over-eager. The per-signal stamp costs one number per signal and only fires for sources the component actually read.
- **Alternative rejected: a version on every signal, recorded per read.** Exact, but it costs a slot per pending source on every collecting render, to save renders only for writes made during the render before the read. Not worth it.
- **Alternative rejected: keep the mount render and fix only `useDerived`.** It leaves the re-render gap and the doubled mount cost.

### 2. Record the count when collection begins

The counter is recorded in `_beginSourceCollection`, at the start of the render, not at its end.

- **Why:** a component that writes, during its own render, a signal it read earlier in that render has shown the old value. Counting from the start of the render treats that write as "after the read", so the commit re-renders the component and it shows the settled value. This is exactly today's mount behavior (pinned by "on mount, re-renders to show a write that settles"), which today comes from the unconditional mount render. Recording at the end would show the stale value.
- **Cost:** a write made during the render to a source *before* it was read is also counted, causing one unnecessary render. That's rare and harmless.
- **A write that never settles** still loops into React's re-render limit error, as today: each render's write is newer than that render's start.

### 3. Tell callers what kind of source changed

`hasInvalidatedSource` reports whether a new source is a derived that isn't CLEAN (the computation might need to rerun: mark STALE, as today) or a signal written since the recorded count (the computation must rerun: mark DIRTY). A STALE mark alone can't make a computation rerun for a signal, because validating a signal does nothing.

- `Derived#_isClean()` keeps its meaning. `Signal#_isClean()` is replaced by the stamp comparison, which needs the recorded count, so the check takes it as a parameter.

### 4. Drain reactions after a derived commits

When `Derived#_commitSourceCollection` marks itself, it drains the reaction queue (outside a batch), as `Reaction#_commitSourceCollection` already does. Otherwise the `reactor` reaction it schedules waits for an unrelated write.

### 5. Mount render only after a Strict Mode remount

`reactor`'s mount effect calls `forceUpdate()` only when it had to create a fresh reaction (the ref is empty after Strict Mode's simulated unmount), because that reaction has no sources until the component renders again. A normal mount relies on the commit check instead.

## Risks / Trade-offs

- **[Order of commit effects changes]** On mount, the `reactor` reaction links to a `useDerived` derived before the derived links its sources. → The derived's commit marks itself DIRTY, which notifies the already linked reaction, and Decision 4 drains it. The known-issue test "useDerived catches signal changes made by ancestor layout effects on mount" covers this.
- **[A component re-renders more often than needed]** Decision 2 counts some writes the render already saw. → At most one extra render, and only when a component writes to a source during its own render.
- **[Benchmark cost]** One more field on `_Signal` and a counter increment per changing write. → Re-run `pnpm bench` against a fresh baseline and accept only noise-level differences. Writes in the benchmark are hot, so check simple component in particular.
- **[Behavior relied on the extra mount render]** Something besides the ancestor-layout-effect case might depend on it. → The full React suite runs without the forced render. The new Strict Mode test covers the one path that keeps it.

## Migration Plan

No API change. Ship as a `patch` changeset for `@signalis/react` and `@signalis/core`. Rollback is a plain revert.
