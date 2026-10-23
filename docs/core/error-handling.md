# Error Handling

User code can throw: derived functions, effect bodies, `when` predicates and callbacks, cleanup functions. Signalis follows one rule for where the error goes, and guarantees that a throw never leaves the reactive graph unable to track or notify.

## Who asked for the work

An error goes to whoever asked for the work that threw. Work that runs because something _else_ changed has no caller, so its error goes to a handler instead.

| Code                                | Who asked  | Where the error goes                                       |
| ----------------------------------- | ---------- | ---------------------------------------------------------- |
| `derived.value`                     | the reader | thrown at the read                                         |
| `createEffect(...)`, first run      | the caller | thrown to the caller; the effect is disposed first         |
| `when(...)`, first check            | the caller | thrown to the caller; the `when` is disposed first         |
| `dispose()` of an effect            | the caller | thrown from the disposer, after the effect is unsubscribed |
| `batch(cb)`                         | the caller | the callback's error propagates                            |
| `signal.value = x`                  | the writer | only the write's own errors (such as a throwing `isEqual`) |
| An effect re-running after a change | nobody     | the error handler                                          |
| A resource's failed fetch           | nobody     | the resource's `error` signal (unchanged)                  |

This is the same split as DOM event listeners: a listener's error goes to `window.onerror`, not to the code that called `dispatchEvent`.

```typescript
import { createEffect, createSignal } from '@signalis/core';

const count = createSignal(0);

// A first-run error reaches the caller, and no effect is left running
try {
  createEffect(() => {
    if (count.value === 0) {
      throw new Error('not ready');
    }
  });
} catch (error) {
  console.error(error);
}
```

## `setErrorHandler`

`setErrorHandler(handler)` installs the handler that receives errors from effects (and `when` callbacks) that re-run because a source changed. It returns a function that restores the previous handler.

```typescript
import { createEffect, createSignal, setErrorHandler } from '@signalis/core';

setErrorHandler((error, info) => {
  // `info.source` is 'effect', 'when', or 'reaction'
  reportToMonitoring(error, info.source);
});

declare function reportToMonitoring(error: unknown, source: string): void;

const price = createSignal(10);

createEffect(() => {
  if (price.value < 0) {
    throw new Error('negative price');
  }
});

price.value = -1; // does not throw; the handler receives the error
```

Install the handler once at startup. Handlers run synchronously while effects are flushing, so a handler should not write signals. If a handler itself throws, its error is rethrown on a later task and the remaining effects still run.

### With no handler

With no handler installed, the error is rethrown asynchronously (`reportError` where it exists, otherwise in a microtask), so it is visible as an uncaught error and fails a test run. In Node that terminates the process by default, the same as an unhandled promise rejection. Install a handler at startup in servers and scripts.

### Collecting errors in a test

```typescript
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createEffect, createSignal, setErrorHandler } from '@signalis/core';

let errors: Array<unknown> = [];
let restore: () => void;

beforeEach(() => {
  errors = [];
  restore = setErrorHandler((error) => {
    errors.push(error);
  });
});

afterEach(() => {
  restore();
});

test('reports an effect error', () => {
  const value = createSignal(0);

  createEffect(() => {
    if (value.value > 0) {
      throw new Error('boom');
    }
  });

  value.value = 1;

  expect(errors).toHaveLength(1);
});
```

### Handling the error inside the effect

If an effect can fail in an expected way, catch it in the effect body. Nothing reaches the handler.

```typescript
import { createEffect, createSignal } from '@signalis/core';

const input = createSignal('{"ok":true}');

createEffect(() => {
  try {
    JSON.parse(input.value);
  } catch {
    // Show a validation message instead
  }
});
```

## An effect stays active after it throws

An effect that throws keeps the sources it read before the throw and runs again when any of them changes. A throwing effect never prevents other queued effects from running, and a write or `batch` never throws because of an effect.

## Derived values cache their error

A derived value whose function throws treats the error as its result. It rethrows the same error on every read, without running its function again, until a source it read changes. Its dependents are notified when it starts or stops throwing, so an effect that read it while it was failing runs again when it recovers.

```typescript
import { createDerived, createSignal } from '@signalis/core';

const input = createSignal('{"a":1}');
const parsed = createDerived(() => JSON.parse(input.value) as { a: number });

input.value = '{'; // invalid
try {
  parsed.value;
} catch {
  // SyntaxError, thrown at every read until `input` changes
}

input.value = '{"a":2}';
console.log(parsed.value.a); // 2
```

If the thrown value is a promise (a Suspense-style "not ready yet"), the derived recomputes and its dependents re-run once the promise settles, with no source change.

Catching a derived value's error inside an effect or another derived keeps every dependency the computation read, before and after the `try`.

## Breaking changes

### A write no longer throws because of an effect

An effect's error used to escape through the write that triggered it. Now it goes to the error handler.

```typescript
import { createSignal, setErrorHandler } from '@signalis/core';

declare function report(error: unknown): void;

const price = createSignal(10);

// Before: caught the error of any effect the write triggered
try {
  price.value = -1;
} catch (error) {
  report(error);
}

// After: catch inside the effect, or install a handler
setErrorHandler((error) => report(error));
price.value = -1;
```

### A derived that threw is not retried by a plain re-read

A derived that threw used to run its function again on the next read. Now it rethrows the cached error until a source it read changes. If the function depends on state that is not a signal, move that state into a signal.

```typescript
import { createDerived, createSignal } from '@signalis/core';

// Before: the next read retried, because nothing was cached
let ready = false;
const data = createDerived(() => {
  if (!ready) {
    throw new Error('not ready');
  }
  return 'data';
});

// After: keep the state in a signal, so changing it recomputes the derived
const isReady = createSignal(false);
const data2 = createDerived(() => {
  if (!isReady.value) {
    throw new Error('not ready');
  }
  return 'data';
});
```

### `when` with `final: true`

A `when` created with `final: true` is disposed before its callback runs, so the callback runs at most once even if it throws.

## See Also

- [Effects](/core/effects) - Side effects
- [Derived](/core/derived) - Computed values
- [Utilities](/core/utilities) - `batch()` and `untrack()`
