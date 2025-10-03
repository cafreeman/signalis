# Stopwatch Example

A stopwatch application demonstrating effects with cleanup, time-based reactivity, and derived formatting.

## Vanilla JavaScript

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

// State
const elapsedMs = createSignal(0);
const isRunning = createSignal(false);

// Store current interval ID for manual cleanup
let currentIntervalId: number | null = null;

// Format milliseconds as MM:SS.mmm
const formatted = createDerived(() => {
  const ms = elapsedMs.value;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
});

// Log the formatted time
createEffect(() => {
  console.log('Time:', formatted.value);
});

// Effect for managing the interval with manual cleanup
createEffect(() => {
  // Clear any existing interval when effect re-runs
  if (currentIntervalId !== null) {
    clearInterval(currentIntervalId);
    currentIntervalId = null;
  }

  if (!isRunning.value) return;

  const startTime = Date.now() - elapsedMs.value;
  currentIntervalId = setInterval(() => {
    elapsedMs.value = Date.now() - startTime;
  }, 10);

  // Cleanup function - runs when effect is disposed
  return () => {
    if (currentIntervalId !== null) {
      clearInterval(currentIntervalId);
      currentIntervalId = null;
    }
  };
});

// Controls
function start() {
  isRunning.value = true;
}

function stop() {
  isRunning.value = false;
}

function reset() {
  isRunning.value = false;
  elapsedMs.value = 0;
}

// Example usage
start();
setTimeout(stop, 2000); // Stop after 2 seconds
setTimeout(reset, 3000); // Reset after 3 seconds
```

## React Implementation

```tsx
import { useSignal, useDerived, useSignalEffect, reactor } from '@signalis/react';

const Stopwatch = () => {
  const elapsedMs = useSignal(0);
  const isRunning = useSignal(false);
  const currentIntervalId = useSignal<number | null>(null);

  // Format milliseconds as MM:SS.mmm
  const formatted = useDerived(() => {
    const ms = elapsedMs.value;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  });

  // Effect for managing the interval with manual cleanup
  useSignalEffect(() => {
    // Clear any existing interval when effect re-runs
    if (currentIntervalId.value !== null) {
      clearInterval(currentIntervalId.value);
      currentIntervalId.value = null;
    }

    if (!isRunning.value) return;

    const startTime = Date.now() - elapsedMs.value;
    currentIntervalId.value = setInterval(() => {
      elapsedMs.value = Date.now() - startTime;
    }, 10); // Update every 10ms for smooth display

    // Cleanup function - runs when effect is disposed (component unmount)
    return () => {
      if (currentIntervalId.value !== null) {
        clearInterval(currentIntervalId.value);
        currentIntervalId.value = null;
      }
    };
  });

  const start = () => (isRunning.value = true);
  const stop = () => (isRunning.value = false);
  const reset = () => {
    isRunning.value = false;
    elapsedMs.value = 0;
  };

  return (
    <div className="stopwatch">
      <div className="display">
        <h1>{formatted.value}</h1>
      </div>

      <div className="controls">
        {!isRunning.value ? (
          <button onClick={start}>Start</button>
        ) : (
          <button onClick={stop}>Stop</button>
        )}
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
};

export default reactor(Stopwatch);
```

## Key Concepts Demonstrated

### 1. Effects with Cleanup

The effect runs when `isRunning` changes, and returns a cleanup function that runs when the effect is disposed:

```typescript
useSignalEffect(() => {
  // Clear any existing interval when effect re-runs
  if (currentIntervalId.value !== null) {
    clearInterval(currentIntervalId.value);
    currentIntervalId.value = null;
  }

  if (!isRunning.value) return;

  const startTime = Date.now() - elapsedMs.value;
  currentIntervalId.value = setInterval(() => {
    elapsedMs.value = Date.now() - startTime;
  }, 10);

  // Cleanup function - runs when effect is disposed
  return () => {
    if (currentIntervalId.value !== null) {
      clearInterval(currentIntervalId.value);
      currentIntervalId.value = null;
    }
  };
});
```

### 2. Time-Based Reactivity

Instead of incrementing a counter, we calculate elapsed time from the start time:

```typescript
const startTime = Date.now() - elapsedMs.value;
const intervalId = setInterval(() => {
  elapsedMs.value = Date.now() - startTime;
}, 10);
```

This approach:

- Accounts for pause/resume correctly
- Avoids drift from setInterval timing
- Maintains accurate elapsed time

### 3. Derived Formatting

The display format is a pure derivation from the elapsed milliseconds:

```typescript
const formatted = useDerived(() => {
  const ms = elapsedMs.value;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
});
```

### 4. State Management

Simple boolean flag controls the timer state:

```typescript
const isRunning = useSignal(false);

const start = () => (isRunning.value = true);
const stop = () => (isRunning.value = false);
const reset = () => {
  isRunning.value = false;
  elapsedMs.value = 0;
};
```

## Effect Cleanup Behavior

**Important**: In Signalis, effect cleanup functions only run when the effect is disposed, not before each re-run. This is different from some other reactive libraries.

- **Vanilla JavaScript**: Cleanup runs when you call the `dispose()` function returned by `createEffect()`
- **React**: Cleanup runs when the component unmounts (the `dispose()` function is called automatically)

This design prevents:

- Infinite loops from cleanup functions that mutate reactive state
- Spurious dependencies from cleanup reads polluting the dependency graph
- Race conditions during synchronous reactive updates

For more details, see the [Effects documentation](/core/effects#effect-cleanup).

## Enhancements

Try adding:

- **Lap times**: Store an array of lap times
- **Split times**: Show current lap vs total time
- **Pause indicator**: Visual feedback when stopped
- **Countdown mode**: Count down from a set time
- **Persistence**: Save state to localStorage

## See Also

- [Effects](/core/effects) - Understanding effects and cleanup
- [Derived](/core/derived) - Computed values
- [useSignalEffect](/react/use-signal-effect) - React hook for effects
