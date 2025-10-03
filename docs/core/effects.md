# Effects

While derived values represent reactive _values_, effects represent reactive _functions_. Effects run side effects in response to signal changes and evaluate eagerly (unlike derived values which are lazy).

## Key Characteristics

- **Eager**: Runs immediately when created and when dependencies change
- **Side Effects**: Designed for side effects (logging, DOM updates, API calls)
- **Disposable**: Returns a cleanup function
- **Smart**: Uses the same recomputation heuristic as derived values

## Creating Effects

### Basic Usage

```typescript
import { createSignal, createEffect } from '@signalis/core';

const count = createSignal(0);

createEffect(() => {
  console.log(`The value of count is: ${count.value}`);
});
// Immediately logs: "The value of count is: 0"

count.value = 1; // Logs: "The value of count is: 1"
count.value = 2; // Logs: "The value of count is: 2"
```

## API Reference

### `createEffect(fn: () => void | (() => void)): () => void`

Creates an effect that runs immediately and whenever its dependencies change.

**Parameters:**

- `fn`: A function that reads reactive values and performs side effects. Can optionally return a cleanup function.

**Returns:** A disposal function to stop the effect and run cleanup

## Effect Lifecycle

### 1. Creation

Effect runs immediately upon creation.

### 2. Dependencies Change

Effect reruns whenever tracked dependencies change.

### 3. Disposal

Cleanup function (if provided) runs when effect is disposed or before it reruns.

```typescript
import { createSignal, createEffect } from '@signalis/core';

const count = createSignal(0);

const dispose = createEffect(() => {
  console.log(`Count: ${count.value}`);

  return () => {
    console.log('Cleaning up!');
  };
});
// Logs: "Count: 0"

count.value = 1;
// Logs: "Cleaning up!" then "Count: 1"

dispose();
// Logs: "Cleaning up!"
```

## Common Patterns

### DOM Manipulation

```typescript
import { createSignal, createEffect } from '@signalis/core';

const message = createSignal('Hello!');

createEffect(() => {
  const element = document.getElementById('message');
  if (element) {
    element.textContent = message.value;
  }
});

// Update the signal - DOM updates automatically
message.value = 'Welcome to Signalis!';
```

### Logging

```typescript
import { createSignal, createEffect } from '@signalis/core';

const logLevel = createSignal('info');

createEffect(() => {
  console.log(`Log level changed to: ${logLevel.value}`);
});

// Update log level - effect runs automatically
logLevel.value = 'debug';
// Logs: "Log level changed to: debug"

logLevel.value = 'error';
// Logs: "Log level changed to: error"
```

### API Calls

```typescript
import { createSignal, createEffect } from '@signalis/core';

const selectedUserId = createSignal(null);

createEffect(() => {
  if (selectedUserId.value) {
    console.log(`Loading user ${selectedUserId.value}...`);
    fetch(`/api/users/${selectedUserId.value}`)
      .then((res) => res.json())
      .then((data) => console.log('User data:', data));
  }
});

// User selects a different user - effect runs automatically
selectedUserId.value = 123;
// Logs: "Loading user 123..." and fetches data
```

### Subscriptions

```typescript
import { createSignal, createEffect } from '@signalis/core';

const topic = createSignal('news');

createEffect(() => {
  const subscription = messagebus.subscribe(topic.value, handleMessage);

  return () => {
    subscription.unsubscribe();
  };
});
```

## Smart Recomputation

Effects use the same smart recomputation as derived values, but they're for side effects, not values:

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

const count = createSignal(1);
const isOdd = createDerived(() => count.value % 2 !== 0);

createEffect(() => {
  // This effect only runs when isOdd actually changes
  console.log(`Number is ${isOdd.value ? 'odd' : 'even'}`);
});

count.value = 3; // No log - isOdd is still true
count.value = 4; // Logs: "Number is even" - isOdd changed from true to false
count.value = 6; // No log - isOdd is still false
```

## Disposal and Cleanup

### Manual Disposal

```typescript
import { createSignal, createEffect } from '@signalis/core';

const count = createSignal(0);

const dispose = createEffect(() => {
  console.log(`count.value is: ${count.value}`);
});

count.value = 1; // Logs
count.value = 2; // Logs

dispose(); // Stop the effect

count.value = 3; // No log (effect is disposed)
```

### Cleanup Function

```typescript
import { createSignal, createEffect } from '@signalis/core';

function createTimer() {
  const time = createSignal(0);
  let interval: number;

  const dispose = createEffect(() => {
    console.log(time.value);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      console.log('Stopped!');
    };
  });

  return {
    start() {
      interval = setInterval(() => {
        time.value++;
      }, 1000);
    },
    stop() {
      dispose();
    },
  };
}

const timer = createTimer();
timer.start(); // Starts logging every second: 1...2...3...
timer.stop(); // Clears interval, logs 'Stopped!'
```

## Reacting to Derived Values

Effects work seamlessly with derived values:

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

const firstName = createSignal('Jane');
const lastName = createSignal('Doe');

const fullName = createDerived(() => `${firstName.value} ${lastName.value}`);

createEffect(() => {
  console.log(`Full name: ${fullName.value}`);
});
// Logs: "Full name: Jane Doe"

firstName.value = 'Janet';
// Logs: "Full name: Janet Doe"
```

## Conditional Effects

Effects can have conditional logic that changes their dependencies:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const showDetails = createSignal(false);
const userName = createSignal('Alice');
const userEmail = createSignal('alice@example.com');
const lastLogin = createSignal('2024-01-01');

createEffect(() => {
  if (showDetails.value) {
    // When true: depends on showDetails, userName, and userEmail
    console.log(`User: ${userName.value} (${userEmail.value})`);
  } else {
    // When false: depends on showDetails and lastLogin
    console.log(`Last login: ${lastLogin.value}`);
  }
});

// Initially logs: "Last login: 2024-01-01"
// Effect depends on: showDetails, lastLogin

lastLogin.value = '2024-01-02';
// Logs: "Last login: 2024-01-02"
// Still depends on: showDetails, lastLogin

userName.value = 'Bob'; // No log - userName not in current dependencies

showDetails.value = true;
// Logs: "User: Bob (alice@example.com)"
// Now depends on: showDetails, userName, userEmail

userEmail.value = 'bob@example.com';
// Logs: "User: Bob (bob@example.com)"
// Dependencies remain: showDetails, userName, userEmail

lastLogin.value = '2024-01-03'; // No log - lastLogin not in current dependencies
```

## Effect Cleanup

The cleanup function returned from an effect runs when the effect is disposed:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const isActive = createSignal(false);
const elapsed = createSignal(0);

const dispose = createEffect(() => {
  if (!isActive.value) return;

  console.log('Starting timer');

  const intervalId = setInterval(() => {
    elapsed.value++;
  }, 1000);

  return () => {
    console.log('Cleaning up timer');
    clearInterval(intervalId);
  };
});

isActive.value = true;
// Logs: "Starting timer"
// Timer starts incrementing elapsed every second

isActive.value = false;
// Logs: "Starting timer" (effect re-runs)
// Does NOT log: "Cleaning up timer"
// Previous interval is still running! Now we have TWO intervals.

dispose();
// Logs: "Cleaning up timer"
// Only now does cleanup run, clearing the most recent interval
```

### Cleanup Use Cases

Cleanup is useful for removing event listeners or clearing timers when the effect is disposed:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const isTracking = createSignal(false);
const mousePosition = createSignal({ x: 0, y: 0 });

const dispose = createEffect(() => {
  if (!isTracking.value) return;

  const handleMouseMove = (e: MouseEvent) => {
    mousePosition.value = { x: e.clientX, y: e.clientY };
  };

  window.addEventListener('mousemove', handleMouseMove);

  // Cleanup: remove listener when effect is disposed
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
  };
});

isTracking.value = true; // Start tracking mouse

// Later: stop tracking and clean up
dispose();
```

## Batching Effect Updates

Use `batch()` to prevent effects from running multiple times:

```typescript
import { createSignal, createEffect, batch } from '@signalis/core';

const firstName = createSignal('Jane');
const lastName = createSignal('Doe');

createEffect(() => {
  console.log(`Name: ${firstName.value} ${lastName.value}`);
});
// Logs: "Name: Jane Doe"

// Without batching
firstName.value = 'Janet';
// Logs: "Name: Janet Doe"
lastName.value = 'Smith';
// Logs: "Name: Janet Smith"

// With batching
batch(() => {
  firstName.value = 'Jane';
  lastName.value = 'Doe';
});
// Only logs once: "Name: Jane Doe"
```

## Performance Tips

### Minimize Dependencies

Only read signals you actually need to avoid unnecessary re-runs:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const userId = createSignal(123);
const searchQuery = createSignal('');

// ❌ Bad: Fetches user profile whenever search query changes too
createEffect(() => {
  const id = userId.value;
  const query = searchQuery.value; // Accidentally creates dependency!

  fetch(`/api/users/${id}`)
    .then((res) => res.json())
    .then((data) => console.log(data));
});

// ✅ Better: Only read the signals you actually use
createEffect(() => {
  fetch(`/api/users/${userId.value}`)
    .then((res) => res.json())
    .then((data) => console.log(data));
});
// Now only re-fetches when userId changes
```

## Gotchas

### Don't Return Values

Effects are for side effects, not values:

```typescript
import { createSignal, createEffect, createDerived } from '@signalis/core';

// ❌ Wrong: Returning a non-cleanup value
const doubled = createEffect(() => {
  return count.value * 2; // This is ignored!
});

// ✅ Correct: Use createDerived for values
const doubled = createDerived(() => count.value * 2);
```

### Cleanup Timing

Cleanup runs **only on disposal**, not before effect re-runs:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const count = createSignal(0);
let runCount = 0;

const dispose = createEffect(() => {
  count.value; // Track dependency
  const run = ++runCount;
  console.log(`Effect ${run} starting`);

  return () => {
    console.log(`Effect ${run} cleanup`);
  };
});

count.value = 1;
// Logs: "Effect 2 starting"
// Note: Cleanup does NOT run before re-execution

dispose();
// Logs: "Effect 2 cleanup"
```

This design is intentional to prevent:

- Infinite loops from cleanup functions mutating reactive state
- Spurious dependencies from cleanup reads polluting the dependency graph
- Race conditions during synchronous reactive updates

If you need to clean up resources before each re-run, manage them manually within the effect body:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const delay = createSignal(1000);
let intervalId: number | null = null;

const dispose = createEffect(() => {
  const currentDelay = delay.value;

  // Clean up previous interval manually
  if (intervalId !== null) {
    clearInterval(intervalId);
  }

  // Set up new interval
  intervalId = setInterval(() => {
    console.log('Tick with delay:', currentDelay);
  }, currentDelay);

  // This cleanup only runs on disposal
  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
  };
});

delay.value = 500;
// Manually clears old interval and creates new one

dispose();
// Cleanup function runs, clearing the final interval
```

### Avoid Infinite Loops

Don't update signals that the effect depends on:

```typescript
import { createSignal, createEffect } from '@signalis/core';

const count = createSignal(0);

// ❌ Infinite loop!
createEffect(() => {
  console.log(count.value);
  count.value++; // This triggers the effect again!
});

// ✅ Don't update dependencies inside effects
createEffect(() => {
  console.log(count.value);
  // Safe: use a different signal or external state
});
```

## Effects vs Derived

| Feature      | Effects          | Derived         |
| ------------ | ---------------- | --------------- |
| Purpose      | Side effects     | Computed values |
| Evaluation   | Eager            | Lazy            |
| Return value | Cleanup function | Computed value  |
| Side effects | Encouraged       | Avoid           |
| Readonly     | N/A              | Yes             |

## See Also

- [Signals](/core/signals) - Writable reactive values
- [Derived](/core/derived) - Computed values (use instead of effects for values)
- [Utilities](/core/utilities) - `batch()` for grouping updates
- [Resources](/core/resources) - For async operations with loading states
