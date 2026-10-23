# Design

This document is meant to be read cold. It records the evidence, the invariants, every decision with the alternatives that were rejected and why, what was verified and how, and what is deliberately left alone. See proposal.md for the motivation and specs/ for the behavior contract.

## Context

### How state is tracked (read `packages/core/src/state.ts`, "How updates flow through the graph", first)

- A signal write marks its direct observers DIRTY. A derived leaving CLEAN marks its own observers STALE exactly once. Reads pull lazily through `Derived#validate`; reactions (effects) are queued by `markUpdate` and drained by `runReactions` (last in, first out).
- These invariants hold in a world where user code never throws:
  - **I1 (notify once).** A non-CLEAN derived has only non-CLEAN observers. A derived notifies its observers only when it first leaves CLEAN, so an already non-CLEAN derived is silent.
  - **I2 (queued).** A non-CLEAN reaction is in the queue (`_isScheduled`). `Reaction#markUpdate` schedules a reaction only when its status rises (`this.status < status`), so an already-DIRTY reaction is never scheduled again.
  - **I3 (stack discipline).** `runningComputation`, `currentContext` and `currentContextIndex` (module-level in `state.ts`) are restored when a computation exits.
  - **I4 (links).** `reconcileSources` runs once per compute and makes the source/observer links match what the computation read.
  - **I5 (counters).** `batchCount` and `suspendedCount` are balanced. These already use `try/finally` and are fine.
- Marking (`markUpdates`, `Derived._markObserversStale`, `Reaction#markUpdate`) runs no user code, so it cannot throw. User code runs in exactly these places: `Derived#compute` (the derived function), `Reaction#compute`/`trap` (an effect body, the `when` predicate and callback, `reactor`'s render), a cleanup function in `Reaction#dispose`, `isEqual` in the signal setter (it runs before any mutation, so a throw there is safe), store getters, and the `batch`/`update` callbacks.

### What a throw does today (reproduced on `main`; released `@signalis/core@0.2.5` differs, see below the table)

Each snippet was run as a vitest test against the source, on `main` and on this branch, with identical results. `s` etc. are `createSignal`s.

| # | Snippet | Observed | Broken |
|---|---|---|---|
| E1 | `createEffect(() => { const v = s.value; calls++; if (v === 1) throw new Error('boom') })`; then `s.value = 1` (throws `boom` out of the write), `s.value = 2`, `s.value = 3` | `calls` stays 2: the effect never runs again. Its status is DIRTY after the throw. | I2. `Reaction#validate` sets CLEAN only after `compute()` succeeds, so a throw leaves it DIRTY and `markUpdate` can never raise it. |
| E2 | `d = createDerived(() => { if (s.value === 1) throw ...; return s.value })`; `createEffect(() => { d.value; calls++ })`; `s.value = 1` (throws), `s.value = 2` | The effect stays dead (calls 1) even after `d` would succeed. | I1/I2. The effect settles or stays non-CLEAN while `d` stays DIRTY; `d`'s next DIRTY mark is a no-op, so nothing notifies the effect. |
| E3 | Two effects on `s`; the one run first (last scheduled) throws; `s.value = 1` | The other effect has not run (stranded) until the next write of any signal. | `runReactions` has no `try`, so a throw aborts the drain with effects still queued. Same without `batch`. |
| E4 | Effect E1 writes `x` (`if (trigger.value>0) x.value = trigger.value`); effect E2 reads `x` and throws; `trigger.value = 1`, then `trigger.value = 2` | E1 ran twice and then stayed at 2: it died, though it did nothing wrong. | A write inside an effect runs a nested `runReactions`; E2's throw propagates through E1's frame, leaving E1 DIRTY (I2). |
| E5 | `batch(() => { s.value = 1; throw new Error('cb') })` with an effect on `s` that also throws | The caller sees `effect`, never `cb`. | `batch`'s `finally` calls `batchEnd`, which flushes; a throw in a `finally` replaces the one in flight. The count is still reset. |
| E6 | `d = createDerived(...)` that throws, read at top level; then `getRunningComputation()` | `d` is still the running computation after the throw. | I3. `Derived#compute` has no `try/finally`; it also resets the context index, so a later reconcile in an enclosing computation uses the wrong context. |
| E7 | `createEffect(() => { s.value; try { d.value } catch {}; other.value })` where `d` reads `hidden` and throws when `s === 2`; then `s.value = 2`; then `hidden.value = 5`, then `other.value = 1` | The effect does not re-run on `hidden`, which only `d` reads. It is still linked to `d` (`d._observers` length 1), and it does re-run on `other`. | I1. `d` stays DIRTY after the throw, so the DIRTY mark from `hidden` is a no-op and `d` never notifies the effect. The leaked frame (I3) does no harm in this shape, because `d` had already linked its sources on its first, successful run. |
| E7b | The same effect, but `d` throws on the effect's first run | The effect's sources end up `[hidden, other]`: it loses `s` and `d`, and takes `d`'s read of `hidden` as its own. `s._observers` and `d._observers` are empty, so changing `s` does not re-run it. | I3/I4. After `d` throws, the globals are still `d`'s frame, so `other.value` lands in `d`'s context, and the effect's `trap` reconciles with that context. A `try/catch` around a derived read inside an effect silently drops dependencies. |
| E8 | `createEffect(() => { calls++; const v = s.value; if (calls === 1) throw ... })` | `createEffect` throws; `s._observers` is empty, and a later write does not run the effect. | Not a bug: `trap` throws before `reconcileSources`, so nothing is subscribed, which is what D1 wants anyway (a first-run throw disposes the effect). Kept as a guard test. |
| E9 | `when(() => s.value > 0, () => { throw ... }, { final: true })`; `s.value = 1` | The callback throws; the reaction is never disposed and is still subscribed (`s._observers` length 1) but dead (E1). | `final` disposes only after the callback returns. |
| E10 | `update(store, d => { d.a = 2; throw ... })` with an effect on the store | The effect ran with `a = 2`: effects see the partial writes. | Not a bug in the bookkeeping. There is no rollback, and running the effects is the only consistent outcome. Stated in the spec; not changed. |
| E11 | `outer = createDerived(() => { a.value; try { inner.value } catch {}; return b.value })` where `inner` throws; read `outer.value` | `outer._sources` is `[b]`: it lost `a` and `inner`. | I3. The same leak as E7b, inside a derived instead of an effect. |
| E12 | A resource whose fetch resolves, and an effect that throws when it sees the resolved value | The effect's error is stored as `resource.error`, as if the fetch had failed. | The write `this.current.value = await this.fetcher()` sits inside the fetch's `try`, so an effect error escaping the write is caught there. D1 fixes this without touching `resource.ts`. |
| E13 | Call an effect's disposer twice | The cleanup function runs twice. If the source has another observer, unstripped source throws `item must be in the array`; in tests and builds the strip plugin (`packages/core/vite.config.ts`) removes that `assert`, so nothing throws. | `Reaction#dispose` does not check `isDisposed`. This change adds dispose paths (D6, D8), so it matters more. |

On released 0.2.5 (the same tests run against the `v0.2.5` tag): E5 differs, because there the callback's error wins, so E5 is a regression since the release, not a long-standing bug. E7 is worse: the effect does not re-run on `s` or `other` either. E10 differs: the effect does not run at all after the recipe throws. `when` and `untrack` are not exported, so E9 does not apply. The other rows behave the same.

Not broken (checked): `untrack`, the batch count, `isEqual` (runs before any mutation), `dispose` ordering (state is reset before the cleanup runs, though a second dispose is not a no-op: E13), the store `set` trap, marking.

### What the React bindings depend on

- `reactor` renders inside `reaction.trap()` with `_beginSourceCollection()`, so sources read during a render are linked only after commit (`_commitSourceCollection` in a `useEffect`). A suspended or interrupted render must record nothing. `AGENTS.md` requires a Suspense regression test asserting the source's observer list stays empty.
- `useDerived` calls `_beginSourceCollection()` in render and commits after commit.
- `useSignalEffect` calls `createEffect` inside `useEffect`, so a throw on the effect's first run propagates out of the effect setup and reaches the nearest React error boundary. This was verified (below), so it must keep working.
- `reactor`'s render throws on purpose: Suspense throws promises and error boundaries need real errors. Whatever catches errors in `Reaction` must therefore not catch inside `trap`.

## Goals / Non-Goals

**Goals:**

- A throw in user code never leaves I1 to I4 broken. After any throw the graph is in a state where later changes still propagate.
- An error surfaces to the code that asked for the work; work with no caller reports to a handler. Behavior is predictable from one rule.
- Keep the behaviors React relies on: first-run effect errors reach error boundaries; Suspense-style thrown promises keep working.
- No new cost on the non-throwing path beyond what the benchmark shows is acceptable.

**Non-Goals:**

- Rollback of a throwing `update()` recipe (E10).
- Making the flush non-reentrant (it would fix E4 differently but changes effect order).
- Effect cleanup before a re-run. `docs/core/effects.md` contradicts itself (line 54 says before a re-run; the section near line 444 says only on disposal). The code matches the latter. Leave it alone.
- A per-effect `onError` option. It can be added later without breaking the global handler.
- Fixing a derived that subscribes twice to a signal it reads twice. That is pre-existing duplicate tracking, unrelated to exceptions, and it inflates observer counts in probes.

## Decisions

### D1. One rule: an error goes to whoever asked for the work

| Code | Who asked | Where the error goes |
|---|---|---|
| `derived.value` | the reader | thrown at the read |
| `createEffect(...)` first run | the caller of `createEffect` | thrown to that caller; the effect is disposed first |
| `when(...)` first check | the caller of `when` | thrown to that caller; the reaction is disposed first |
| `effect.dispose()` | the caller of the disposer | thrown from the disposer, after state is reset |
| `batch(cb)` | the caller | the callback's error propagates |
| `signal.value = x` | the writer | only the write's own errors (`isEqual`) |
| An effect re-running after a change | nobody | the error handler |
| `Resource` fetch failure | nobody | the existing `error` signal (unchanged) |

This is the same split as DOM event listeners (a listener throw goes to `window.onerror`, not to `dispatchEvent`'s caller). **BREAKING:** `try { signal.value = x } catch {}` no longer catches errors from effects. The user explicitly does not want that behavior: it blames the wrong code.

### D2. Effect errors from later runs go to a global handler (Option B), not rethrown at the write (Option A)

- `Option A` (rethrow the first error after draining the queue) was rejected. It keeps `try/catch` around writes working for effect errors, but then any write or `batch` can throw because of unrelated code, the batch needs a "callback's error wins" rule, `Resource`'s writes inside an async function can become unhandled rejections, and E4 (an effect killed by a bystander) remains because a nested flush still aborts its caller. It also needs a policy for several errors (first error versus `AggregateError`).
- `Option B` was chosen. Writes never throw because of effects, E3/E4/E5 and the `Resource` hazard go away, and a failing effect cannot affect others.

### D3. The handler API: `setErrorHandler`

```ts
setErrorHandler(
  handler: ((error: unknown, info: { source: 'effect' | 'when' | 'reaction' }) => void) | null,
): () => void; // restores the previous handler
```

- Global and module-level, like the reactive graph. Exported from `@signalis/core` and re-exported by `@signalis/react` (which already re-exports all of core).
- `source` identifies the construct: `createEffect` sets `'effect'`, `when` sets `'when'`, a bare `Reaction` is `'reaction'`. Implement as an internal field set after construction.
- **Default (no handler, or `null`):** rethrow asynchronously so the error is loud and fails a test run: `reportError(error)` when `typeof reportError === 'function'`, otherwise `queueMicrotask(() => { throw error })`. Verified: Node 24 and jsdom (the React test environment) both lack `reportError`, so tests use the microtask path, which vitest reports as an unhandled error. Do not default to `console.error`, which would let a failing test pass silently.
- **A handler that throws** must not break the flush: catch it and rethrow in a microtask.
- The handler is called synchronously during the flush, once per failed run, in the order the effects ran.

### D4. Where errors are caught

- **`Reaction#validate`** catches errors from the effect and reports them (`try`/`catch`/`finally`, with `status = CLEAN` in the `finally`). The `try` wraps the whole body, including the loop that validates a STALE reaction's sources, not just `compute`, so `validate` does not rely on `Derived#validate` never throwing. Because `validate` never throws, `runReactions` needs no `try` and I2 holds: a failed reaction leaves the queue as CLEAN and a later change raises it again. Setting CLEAN in the `finally` must stay *after* `compute` (moving it before changes how an effect that writes its own source is rescheduled).
- **`Reaction#compute`** keeps throwing. `createEffect` and `when` call `compute()` directly for the first run, so the first-run throw reaches their caller; they catch, call `dispose()`, and rethrow. A flush-driven `validate()` reports instead. This is how D1's "who asked" maps to code. `Reaction` is public, so direct users of `compute()` see a throw and flush-driven runs report.
- **`Reaction#trap`** must reconcile the sources read before a throw (partial reconcile) on the error path, then rethrow, because `trap`'s `finally` restores the globals before `compute` could see them. Branch on `_isCollecting` exactly as the success path does:
  - not collecting (an effect): `reconcileSources(this)` with the current globals, then rethrow;
  - collecting (a `reactor` render): record nothing and rethrow, as today, so a suspended or errored render leaves no observers. Never reconcile eagerly in collecting mode.
- **`Derived#compute`:** wrap the derived function in `try/catch`; on a throw keep the error, then reconcile (partial reads, branching on `_isCollecting` exactly like the success path, so `_hasPendingSources` and the pending context are recorded when collecting), then restore the globals in a `finally`. The reconcile must happen *before* the restore, using the derived's own frame.
- **Keep an effect subscribed after a throw** (partial reconcile): it retries when any source it read before the throw changes. Throwing on the first run is the exception (D1): the effect is disposed, because `createEffect` returns no disposer on a throw and a live effect would leak (for example past a `useSignalEffect` unmount).

### D5. A derived that throws caches its error, not retry

- On a throw the derived stores the error, settles CLEAN, and counts as *changed* so its observers are marked DIRTY (an error replacing a value, a value replacing an error, or a different error object all count; the same error object does not). It rethrows on every read via `Derived#value`, after `markDependency` so the reader stays subscribed. It keeps the sources it read before the throw, so a change to any of them marks it DIRTY and it recomputes. `dispose()` drops the cached error but keeps the fact that observers last saw one (the error becomes a sentinel that nothing matches), so a derived that recovers after a dispose to the value it had before it threw still counts as a change for its observers.
- **Why not retry** (settle CLEAN with an error flag and recompute on the next read, which is today's observable behavior): the derived is still subscribed by effects that threw reading it. When a top-level read (for example an event handler) later recomputes it successfully, those effects must be marked DIRTY from inside a read. Either nothing drains the queue until some unrelated write (the same stranded-effect bug fixed for `dispose`), or reads start running effects. Caching keeps the rule that reads never schedule effects.
- **Why not leave the derived DIRTY after a throw** (also today's behavior): it breaks I1. Its next DIRTY mark is a no-op, so its observers are never notified (E2). Any approach that leaves a derived non-CLEAN after a failed compute has this defect. An earlier idea (CLEAN in a `finally` on the reaction plus leaving the derived DIRTY) was tried on paper and does not revive E2.
- **The cost, verified with React tests:**
  - (a) A long-lived (module-level) `createDerived` that keeps throwing until some non-reactive state changes renders correctly after an error-boundary reset with no write in between. Under caching it stays errored until a source it read changes.
  - (b) A module-level derived that throws only on its first compute never reaches the boundary today: React's own recovery re-render (it reports a recoverable error whose `cause` is the derived's error) re-reads it, and it recomputes. Under caching that re-render rethrows the cached error, so the boundary shows an error that today recovers silently.
  - A `useDerived` derived is created fresh when the boundary remounts the subtree, so neither (a) nor (b) affects it.
  - (c) A derived that throws a promise inside `<Suspense>` resumes once the promise resolves, with no write. Caching would break this, so it is handled by the thenable rule below.
- **Thenable rule:** when the thrown value is thenable, attach `then(invalidate, invalidate)` once per distinct thenable. `invalidate` does nothing if the derived has been disposed or its cached error is no longer that thenable. Otherwise it marks the derived DIRTY (which notifies observers STALE through the usual walk; they revalidate, recompute it, and run only if its value changed) and runs `runReactions()` when no batch is open. This is the only place a derived causes reactions to run, and it does so from an asynchronous callback, not from a read.
- **Ordering the thenable rule relies on:** the derived attaches its `then` while computing, before the throw reaches React, so `invalidate` runs before React's own retry callback on the same promise. React's retry render then finds the derived DIRTY and recomputes it. Attaching the callback later (for example lazily on the next read) would let React retry against the cached promise.

### D6. `createEffect` / `when`: first-run errors are thrown

The first run has a caller, so D1 applies. This also keeps React error boundaries working: `useSignalEffect` runs `createEffect` in `useEffect` setup, and React routes a passive-effect setup error to the nearest boundary. Verified during review with a React test that task 1.5 re-creates: a `useSignalEffect` that throws on its first run, inside an error boundary, is caught by the boundary. Reporting first-run errors instead would silently stop boundaries from catching them.

### D7. `dispose()` throws a cleanup error to its caller

State is already fully reset before the cleanup function runs in `Reaction#dispose` (unlink, `isDisposed = true`, flags cleared), so letting the cleanup's error propagate is safe. A second `dispose()` returns early (E13), so it neither unlinks again nor runs the cleanup again; without that, a final `when` whose callback throws on the first check would be disposed twice (D8, then the first-run catch in D6). `reactor`'s unmount cleanup should null its ref before disposing so a throwing dispose cannot leave a disposed reaction in the ref.

### D8. `when({ final: true })` disposes before it calls its callback

So "final" means at most once even when the callback throws (E9). Both `when` variants run the callback outside `trap`; a later-run callback error goes to the handler with `source: 'when'`.

### D9. `batch` and `batchEnd` need no code change

Because `validate` never throws, `batchEnd` never throws because of an effect, so a callback's error is no longer replaced (E5) without touching `batch.ts`. Tests prove it.

### D10. Context restoration is unconditional

`Derived#compute` restores `runningComputation`, `currentContext` and `currentContextIndex` in a `finally`, mirroring `Reaction#trap`/`compute`.

## Risks / Trade-offs

- **[Hot path]** `try`/`catch`/`finally` on `Derived#compute` and `Reaction#compute`/`validate`, which the earlier performance work tuned (#70, #72). → Benchmark with a baseline plus a drift run on unchanged code and an after run (`pnpm bench`, median of 10, every cell `ok`, identical counts). A regression beyond drift needs a note here and a decision from the user. Keep the `try` out of per-iteration loops (`runReactions` has none).
- **[Hot read path]** A cached error adds a check to `Derived#value`, which every read goes through. Keep it off the common path where possible (for example, check it only after the existing `_status !== CLEAN` test, or encode it so a CLEAN read without an error pays one comparison) and cover it in the benchmark.
- **[Measured: a small slowdown on the hot path]** Measured with `pnpm bench` on one machine, signalis against the alien-signals engine in the same run (alien did not change, so the ratio cancels machine drift, which was up to 8% between runs of identical code). Interleaved runs, 20 repeats, mean ratio relative to the unchanged code:

  | scenario | finished change | original `Derived#compute` put back | original `Reaction` put back |
  | --- | --- | --- | --- |
  | simple component | +5.1% | -0.3% | +6.1% |
  | dynamic component | +3.3% | +1.1% | +1.7% |
  | large web app | +4.2% | +1.9% | +4.3% |

  A final interleaved run of all six scenarios (3 rounds, 20 repeats) gave: simple component +6.8%, dynamic component +3.3%, large web app +4.3%, wide dense +1.9%, deep -0.7%, very dynamic +2.6%, with every cell `ok` and identical counts. The user accepted this cost. The whole cost is the `try` around the derived function in `Derived#compute`: putting the original `compute` back removes it even with the new fields and the `_hasError` check on reads still in place, and putting the original `Reaction` back recovers nothing. Reshaping did not help either: the same `try` in a separate method, in `validate`, split so the catch work is out of line, cheaper tails (store the error fields only on error), and a read-path `throw` moved out of line all measured the same as the finished change. The check on reads costs nothing measurable. No reshaping can drop the `try` and keep the specified guarantees, because the E7b and E11 cases have user code catch a derived's error and keep reading, so the tracking state has to be restored in the frame that threw.
- **[Breaking: no effect errors at the write]** → Documented in the changeset and the new docs page; `minor` because it adds an export and corrects behavior no one should depend on.
- **[Breaking: a derived that threw is not retried by a plain re-read]** → Documented. The thenable rule covers Suspense; a long-lived derived that threw stays errored until a source it read changes, and a derived that throws only on its first compute now reaches an error boundary instead of being recovered by React's re-render (D5 cost b).
- **[The default handler is fatal in Node]** With no handler, an effect error on a later run is rethrown in a microtask, which is an uncaught exception: in Node (SSR, scripts, servers) it terminates the process by default, the same as an unhandled promise rejection. Today the same error is thrown synchronously at the write, where the caller can catch it. → Intended, so errors are never silent, but the docs page and the changeset must say so and show installing a handler at startup.
- **[Handler runs synchronously inside the flush]** → A handler that writes signals re-enters the graph. Document that handlers should not write signals; a thrown handler error is rethrown in a microtask.
- **[Tests that trigger effect errors fail the run by default]** → Intended (loud default). Tests set `setErrorHandler` and restore it in `afterEach`.
- **[Partial reconcile subscribes to what was read before the throw]** → An effect may run again for a source that is unrelated to the cause of its failure. Acceptable: it is the same set it would have tracked had it not thrown.

## Migration Plan

No data migration. Ship as a `minor` changeset for `@signalis/core` (`@signalis/react` bumps in lockstep): add `setErrorHandler`, and describe both behavior changes with before/after snippets. Add a docs page (see tasks). Rollback is a plain revert.

## What was already verified (so it need not be re-derived)

Each claim below was checked during review with a vitest test run against the source. Those tests asserted today's broken behavior, so they were not committed. Tasks 1.1 to 1.5 re-create each one as a test of the intended behavior, which puts the evidence in the repo along with the fix. They established:
- E1 to E13 above, on `main` and on this branch, and the 0.2.5 differences, against the `v0.2.5` tag.
- That `Derived#compute` leaks the running computation (E6) and corrupts the sources of whatever catches its error (E7b, E11).
- That `reportError` is undefined in Node 24 and in jsdom.
- That a `useSignalEffect` first-run throw reaches an error boundary.
- That an abandoned render whose `useDerived` throws leaves the signal with no observers.
- That a module-level derived that keeps throwing re-renders correctly after a boundary reset with no write, and that one that throws only once is recovered by React's own re-render without reaching the boundary.
- That a derived throwing a promise inside Suspense resumes.
- That a derived that throws once returns a value on a plain re-read.

The last four are the behaviors D5 deliberately changes or preserves.

## Open Questions

None that block implementation. To check while implementing: whether `Reaction`'s direct users in `packages/react/src` (`reactor`) need any change beyond nulling the ref before `dispose`; and the exact wording of the docs page.
