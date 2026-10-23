---
'@signalis/core': minor
---

Harden error handling: a throw in user code no longer breaks the reactive graph, and errors go to the code that asked for the work

- Add `setErrorHandler(handler)`, which receives errors thrown by effects (and `when` callbacks) that re-run because a source changed, along with `{ source: 'effect' | 'when' | 'reaction' }`. It returns a function that restores the previous handler. With no handler, the error is rethrown asynchronously, so it is visible as an uncaught error. In Node that terminates the process by default, so install a handler at startup
- **BREAKING:** an effect's error no longer escapes through the write or `batch` that triggered it. A `try/catch` around `signal.value = x` no longer catches errors from effects; handle them inside the effect or with `setErrorHandler`. Before: `try { price.value = -1 } catch (e) { report(e) }`. After: `setErrorHandler(report); price.value = -1`
- **BREAKING:** a derived value that throws caches its error and rethrows it on every read until a source it read changes; it no longer retries its function on the next read. State that is not a signal can no longer be used to make a failed derived succeed. If the error is a promise, the derived recomputes once the promise settles
- An effect that throws stays active: it keeps the sources it read before the throw and runs again when any of them changes, and other queued effects still run
- A derived that throws no longer corrupts tracking: the running computation is restored, and an effect or derived that catches its error keeps its dependencies
- A `batch` callback's error is no longer replaced by an effect's error
- `createEffect` and `when` dispose themselves and throw when their first run throws
- `when(..., { final: true })` is disposed before its callback runs, so the callback runs at most once even if it throws
- Disposing an effect twice now runs its cleanup once
- A write to a resource no longer records an effect's error as the resource's error
