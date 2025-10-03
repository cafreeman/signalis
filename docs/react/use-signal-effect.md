# useSignalEffect

The `useSignalEffect` hook creates an effect that automatically tracks signal dependencies and re-runs when they change, similar to React's `useEffect` but with automatic signal tracking.

## Signature

```ts
function useSignalEffect(fn: () => void | (() => void), deps?: DependencyList): void;
```

## Basic Usage

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(0);

  useSignalEffect(() => {
    console.log(`Count changed to: ${count.value}`);
  });

  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
});
```

## Signal-Only Dependencies

When your effect only depends on signals, no dependency array is needed:

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const App = reactor(() => {
  const count = useSignal(0);
  const name = useSignal('Jane');

  // No deps array - signal dependencies tracked automatically
  useSignalEffect(() => {
    document.title = `${name.value}: ${count.value}`;
  });

  return <div>...</div>;
});
```

## Mixed Dependencies

When depending on both signals AND non-signal values (props, `useState`, `useContext`), include non-signal values in the `deps` array:

```typescript
const UserProfile = reactor(({ userId }: { userId: string }) => {
  const refreshCount = useSignal(0);

  useSignalEffect(() => {
    // Effect runs when:
    // 1. Component mounts
    // 2. userId prop changes (via deps array)
    // 3. refreshCount signal changes (via automatic tracking)
    fetchUserData(userId, refreshCount.value);
  }, [userId]); // userId must be in deps!

  return (
    <div>
      <button onClick={() => refreshCount.value++}>Refresh</button>
    </div>
  );
});
```

## Cleanup

Return a cleanup function to run on unmount or before the next effect run:

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const Timer = reactor(() => {
  const count = useSignal(0);

  useSignalEffect(() => {
    const interval = setInterval(() => {
      count.value++;
    }, 1000);

    // Cleanup function
    return () => {
      clearInterval(interval);
    };
  });

  return <div>Count: {count.value}</div>;
});
```

## Comparison with useEffect

### Traditional useEffect

```tsx
import { useState, useEffect } from 'react';

function Logger() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('Jane');

  useEffect(() => {
    console.log(`${name}: ${count}`);
  }, [name, count]); // Must list all dependencies

  return <div>...</div>;
}
```

### With useSignalEffect

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const Logger = reactor(() => {
  const count = useSignal(0);
  const name = useSignal('Jane');

  useSignalEffect(() => {
    console.log(`${name.value}: ${count.value}`);
  }); // No dependency array needed!

  return <div>...</div>;
});
```

## Common Patterns

### Document Title

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const App = reactor(() => {
  const count = useSignal(0);

  useSignalEffect(() => {
    document.title = `Count: ${count.value}`;
  });

  return <div>{count.value}</div>;
});
```

### Local Storage Sync

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(() => {
    const saved = localStorage.getItem('count');
    return saved ? parseInt(saved, 10) : 0;
  });

  useSignalEffect(() => {
    localStorage.setItem('count', count.value.toString());
  });

  return (
    <div>
      <p>{count.value}</p>
      <button onClick={() => count.value++}>+</button>
    </div>
  );
});
```

### Event Listeners

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const WindowSize = reactor(() => {
  const width = useSignal(window.innerWidth);
  const height = useSignal(window.innerHeight);

  useSignalEffect(() => {
    const handleResize = () => {
      width.value = window.innerWidth;
      height.value = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  return (
    <div>
      {width.value} x {height.value}
    </div>
  );
});
```

### API Calls

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

interface User {
  name: string;
}

const UserProfile = reactor(({ userId }: { userId: string }) => {
  const user = useSignal<User | null>(null);
  const loading = useSignal(false);

  useSignalEffect(() => {
    loading.value = true;

    fetchUser(userId)
      .then((data) => (user.value = data))
      .finally(() => (loading.value = false));
  }, [userId]); // userId is a prop, must be in deps

  if (loading.value) return <div>Loading...</div>;
  if (!user.value) return <div>No user</div>;

  return <div>{user.value.name}</div>;
});
```

### Debounced Search

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const Search = reactor(() => {
  const query = useSignal('');
  const results = useSignal<Array<string>>([]);

  useSignalEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.value) {
        searchAPI(query.value).then((data) => (results.value = data));
      } else {
        results.value = [];
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  });

  return (
    <div>
      <input value={query.value} onChange={(e) => (query.value = e.target.value)} />
      <ul>
        {results.value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
});
```

### Logging

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const DebugLogger = reactor(() => {
  const count = useSignal(0);
  const name = useSignal('Jane');

  useSignalEffect(() => {
    console.log('State changed:', {
      count: count.value,
      name: name.value,
      timestamp: new Date().toISOString(),
    });
  });

  return <div>...</div>;
});
```

## With Props and Context

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const DataFetcher = reactor(({ endpoint }: { endpoint: string }) => {
  const data = useSignal(null);
  const refreshTrigger = useSignal(0);

  useSignalEffect(() => {
    fetch(endpoint)
      .then((res) => res.json())
      .then((json) => (data.value = json));

    // Depends on: endpoint (prop) and refreshTrigger (signal)
  }, [endpoint]); // endpoint must be in deps

  const refresh = () => refreshTrigger.value++;

  return (
    <div>
      <pre>{JSON.stringify(data.value, null, 2)}</pre>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
});
```

## Conditional Effects

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

const ConditionalLogger = reactor(() => {
  const count = useSignal(0);
  const enableLogging = useSignal(false);

  useSignalEffect(() => {
    if (enableLogging.value) {
      console.log('Count:', count.value);
    }
  });

  return (
    <div>
      <p>Count: {count.value}</p>
      <label>
        <input
          type="checkbox"
          checked={enableLogging.value}
          onChange={(e) => (enableLogging.value = e.target.checked)}
        />
        Enable Logging
      </label>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
});
```

## Async Effects

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

interface User {
  name: string;
}

const AsyncDataLoader = reactor(() => {
  const userId = useSignal<number | null>(null);
  const user = useSignal<User | null>(null);

  useSignalEffect(() => {
    if (!userId.value) return;

    let cancelled = false;

    fetchUser(userId.value).then((data) => {
      if (!cancelled) {
        user.value = data;
      }
    });

    // Prevent stale updates
    return () => {
      cancelled = true;
    };
  });

  return <div>...</div>;
});
```

## Dependency Array Rules

Same rules as `useDerived`:

### Signal-Only: No deps array

```tsx
// ✅ Good: Only signals
useSignalEffect(() => {
  console.log(signal1.value, signal2.value);
});
```

### Mixed: Non-signals in deps

```tsx
// ✅ Good: prop in deps
useSignalEffect(() => {
  api.call(userId, signal.value);
}, [userId]);

// ✅ Good: state and context in deps
useSignalEffect(() => {
  doSomething(stateValue, contextValue, signal.value);
}, [stateValue, contextValue]);
```

### Common Mistake: Missing deps

```tsx
// ❌ Bad: userId not in deps - stale closure!
useSignalEffect(() => {
  fetchUser(userId, count.value);
});

// ✅ Correct
useSignalEffect(() => {
  fetchUser(userId, count.value);
}, [userId]);
```

## Effect Timing

`useSignalEffect` runs after React has committed to the DOM (like `useEffect`), not during render.

## Gotchas

### Don't Return Non-Functions

```tsx
// ❌ Wrong: returning a value
useSignalEffect(() => {
  return count.value * 2; // This is ignored!
});

// ✅ Correct: return cleanup function or nothing
useSignalEffect(() => {
  console.log(count.value);
});

useSignalEffect(() => {
  const id = setInterval(() => {}, 1000);
  return () => clearInterval(id); // Cleanup
});
```

### Don't Forget Non-Signal Deps

```tsx
// ❌ Wrong: prop not in deps
const Component = reactor(({ apiKey }) => {
  useSignalEffect(() => {
    api.setKey(apiKey); // apiKey changes won't be seen!
    fetchData(signal.value);
  });
});

// ✅ Correct
const Component = reactor(({ apiKey }) => {
  useSignalEffect(() => {
    api.setKey(apiKey);
    fetchData(signal.value);
  }, [apiKey]);
});
```

### Avoid Infinite Loops

```tsx
// ❌ Infinite loop!
useSignalEffect(() => {
  count.value++; // Updates count, which triggers effect again!
});

// ✅ Correct: use a different signal or external state
useSignalEffect(() => {
  otherSignal.value = count.value + 1; // OK if this doesn't loop back
});
```

## See Also

- [useSignal](/react/use-signal) - Creating signals
- [useDerived](/react/use-derived) - Computed values
- [Effects](/core/effects) - Understanding effects
- [reactor](/react/reactor) - Making components reactive
