# Proposal

## Why

Signalis has not considered what happens to its bookkeeping when user code throws. The reactive graph relies on invariants that a throw breaks. All of it reproduces on `main`, and most of it on the released `@signalis/core@0.2.5` (design.md lists the differences):

- **A throwing effect dies for good.** `Reaction#validate` only returns the reaction to CLEAN after its function succeeds. A throw leaves it DIRTY, and an already-DIRTY reaction is never scheduled again, so later changes to its sources do nothing. The same happens to an effect that reads a derived which throws once, even after the derived recovers.
- **One throw strands the rest of the queue.** `runReactions` has no `try`, so the effects still queued after a thrower wait for the next write of any signal.
- **Effects blame the wrong code.** An effect's error escapes through the write or `batch` that triggered it. A write inside an effect runs a nested flush, so an unrelated effect throwing in that flush kills the writing effect. In a `batch`, an effect's error replaces the callback's own error (a regression since 0.2.5, where the callback's error won). A resource's write sits inside its fetch's `try`, so an effect that throws on the fetched value is recorded as the resource's error.
- **A throwing derived corrupts tracking.** A derived that throws stays DIRTY, so it never notifies its observers again, and an effect that caught its error stops re-running when a signal only the derived reads changes. `Derived#compute` also has no `try/finally`, so after a throw the derived stays registered as the running computation: whatever catches its error (an effect or another derived) loses the dependencies it read before the catch and takes the derived's reads as its own. A top-level read leaks the state.
- **`when({ final: true })` whose callback throws** is never disposed but can never fire again.
- **Disposing twice runs the cleanup twice.** This change adds internal dispose paths, so `dispose()` must become a no-op the second time.

## What Changes

- **Errors go to whoever asked for the work.** Reading a derived, creating an effect (its first run), `when`'s first check, `dispose()` and `batch` throw to their caller, so a plain `try/catch` works. Work that runs because something else changed has no caller: an effect re-running after a write reports its error to a handler instead. **BREAKING:** a `try/catch` around `signal.value = x` no longer catches an error thrown by an effect that the write triggered.
- **A global error handler.** `setErrorHandler(handler)` is a new export, re-exported by `@signalis/react`. It returns a function that restores the previous handler. With no handler, the error is rethrown in a microtask, which is loud and fails tests.
- **Throwing never breaks the bookkeeping.** After an effect throws it settles CLEAN, keeps the sources it read before the throw, and runs again when any of them changes. Other queued effects still run. A write or `batch` never throws because of an effect.
- **A throwing derived caches its error.** It settles CLEAN, treats the error as its new result, and rethrows on every read until a source changes. It keeps the sources it read before the throw. If the error is a thenable (a Suspense-style thrown promise), the derived recomputes once the promise settles. **BREAKING:** a derived that threw is no longer retried by a plain re-read with no source change.
- **Context is restored on every exit.** The running computation, current context and index are restored when a derived or effect throws.
- **`when({ final: true })` disposes before it calls its callback**, so "final" means at most once even when the callback throws.
- **`dispose()` is idempotent.** A second call does nothing.
- **With no handler, an effect error on a later run is an uncaught exception**, which terminates a Node process by default. Today the writer can catch it. The docs and changeset say to install a handler at startup.

### How this was decided

These decisions came out of an audit of every place user code runs (derived functions, effect bodies, `when`, cleanups, `batch`/`update` callbacks, the React bindings), driven by an advisor review and by probes run against the source. The user set the direction: a `try/catch` around a write must not catch an effect's error ("we don't want this behavior at all"), and `batch` must keep effects from running mid-batch. Two options were weighed for effect errors: rethrow the first error after draining the queue, or send it to a handler. The handler was chosen because a write should only throw for its own errors. For a throwing derived, caching the error was chosen over retrying on the next read, because retry forces a read to schedule effects. Both choices, the evidence for every claim above (repro snippets E1 to E13), the invariants a throw breaks, and what was verified, are in design.md. Read it before implementing.

## Capabilities

### New Capabilities

- `error-handling`: where an error thrown by user code surfaces (the caller, or the handler), what state the graph is left in, and the `setErrorHandler` contract.

### Modified Capabilities

- `batch`: a batch callback's error is never replaced by an effect's error, and the end of a batch never throws because of an effect.

## Impact

- **Code:** `packages/core/src/reaction.ts` (`trap`, `validate`, `compute`, `dispose`), `derived.ts` (`compute`, `value`), `state.ts` (`runReactions`, an error handler), `effect.ts`, `when.ts`, `index.ts` (new export); `packages/react/src/index.ts` re-exports. No React binding source change is expected beyond the re-export.
- **Public API:** new `setErrorHandler` export; the two **BREAKING** behavior changes above. `Reaction` is public, so direct users of `compute` see the change too.
- **Performance:** `try`/`finally` lands on `Derived#compute` and `Reaction#compute`, which the earlier performance work tuned. Measure with a baseline plus a drift run, as before.
- **Docs:** `docs/core/` (a page for error handling; `effects.md` also contradicts itself on cleanup, line 54 against line 444, which this change leaves alone).
- **Release:** a `minor` changeset for `@signalis/core` (new export; `@signalis/react` bumps in lockstep).
- **Out of scope:** rollback of a throwing `update()` recipe (effects still see the partial writes), a non-reentrant flush, effect cleanup before a re-run, and the per-effect `onError` option.
- **Stacking:** built on `fix/core-batch-consistency` (PR #72), because it edits the same files and extends the `batch` spec that PR adds.
