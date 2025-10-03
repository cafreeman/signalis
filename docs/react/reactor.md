# reactor

The `reactor` Higher-Order Component is the main integration point between Signalis and React. It wraps components to automatically re-render them when signals they read change.

## Overview

`reactor` uses a Proxy to track signal reads during component rendering. When tracked signals change, the component automatically re-renders. Only reads **during the render phase** are tracked - event handlers and callbacks run outside the reactive context.

## Basic Usage

```tsx
import { createSignal, reactor } from '@signalis/react';

const count = createSignal(0);

const Counter = () => {
  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
};

export default reactor(Counter);
```

## API Reference

### `reactor<T>(component: FunctionComponent<T>): FunctionComponent<T>`

Wraps a functional component to enable automatic re-rendering on signal changes.

**Parameters:**

- `component`: A React functional component

**Returns:** A wrapped component that re-renders when tracked signals change

## How It Works

`reactor` tracks signal dependencies automatically:

1. **Proxy Wrapper**: `reactor` wraps your component in a Proxy that intercepts function calls
2. **Dependency Tracking**: On first render, it establishes a reactive context that triggers re-renders
3. **Render Tracking**: Each render tracks signal reads - only signal reads **during this execution** are tracked
4. **Re-tracking**: Dependencies are re-established on every render, enabling dynamic tracking

**Important**: Only signal reads during the component's render phase are tracked. Reads in event handlers, callbacks, or async functions happen outside the reactive context and won't trigger re-renders.

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = () => {
  const count = useSignal(0);
  const showDouble = useSignal(false);

  return (
    <div>
      <p>Count: {count.value}</p>
      {showDouble.value && <p>Double: {count.value * 2}</p>}
      <button onClick={() => (showDouble.value = !showDouble.value)}>Toggle Double</button>
    </div>
  );
};

export default reactor(Counter);
// Dynamically tracks count and showDouble based on what's rendered
```

## Component Composition

`reactor` works with component composition:

```tsx
import { useSignal, reactor } from '@signalis/react';
import type { Signal } from '@signalis/core';

const DisplayCount = reactor(({ count }: { count: Signal<number> }) => {
  return <div>Count: {count.value}</div>;
});

const Counter = reactor(() => {
  const count = useSignal(0);

  return (
    <div>
      <DisplayCount count={count} />
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
});
```

## With Global Signals

```tsx
// store.ts
import { createSignal } from '@signalis/react';

export const userSignal = createSignal({ name: 'Guest', loggedIn: false });

// UserProfile.tsx
import { reactor } from '@signalis/react';
import { userSignal } from './store';

const UserProfile = () => {
  return (
    <div>
      <h2>{userSignal.value.name}</h2>
      {userSignal.value.loggedIn && <p>Logged in</p>}
    </div>
  );
};

export default reactor(UserProfile);

// Login.tsx
import { userSignal } from './store';

export function login(name: string) {
  userSignal.value = { name, loggedIn: true };
  // UserProfile will automatically re-render
}
```

## Performance Considerations

### Fine-Grained Updates

`reactor` only re-renders when signals that were actually read during the last render change:

```tsx
import { useSignal, reactor } from '@signalis/react';

const App = reactor(() => {
  const count = useSignal(0);
  const name = useSignal('Jane');
  const showName = useSignal(false);

  return (
    <div>
      <p>Count: {count.value}</p>
      {showName.value && <p>Name: {name.value}</p>}
    </div>
  );
});

// Changing name.value won't re-render unless showName.value is true
```

### Memoization Still Helps

Use React's memoization for expensive computations:

```tsx
import { useMemo } from 'react';
import { useSignal, reactor } from '@signalis/react';

const App = reactor(() => {
  const count = useSignal(0);

  const expensiveValue = useMemo(() => {
    return reallyExpensiveComputation(count.value);
  }, [count.value]);

  return <div>{expensiveValue}</div>;
});
```

## React DevTools

Components wrapped with `reactor` appear normally in React DevTools with their original component name.

## TypeScript

`reactor` preserves component types:

```tsx
interface Props {
  initialCount: number;
}

const Counter = ({ initialCount }: Props) => {
  const count = useSignal(initialCount);
  return <div>{count.value}</div>;
};

export default reactor(Counter);
// Type of Counter is still FunctionComponent<Props>
```

## Common Patterns

### Layout Component

```tsx
import { ReactNode } from 'react';
import { useSignal, reactor } from '@signalis/react';

const Layout = reactor(({ children }: { children: ReactNode }) => {
  const theme = useSignal('light');

  return (
    <div className={theme.value}>
      <button onClick={() => (theme.value = theme.value === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
      {children}
    </div>
  );
});
```

### Form Component

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const Form = reactor(() => {
  const email = useSignal('');
  const password = useSignal('');
  const isValid = useDerived(() => email.value.includes('@') && password.value.length >= 8);

  return (
    <form>
      <input value={email.value} onChange={(e) => (email.value = e.target.value)} />
      <input
        type="password"
        value={password.value}
        onChange={(e) => (password.value = e.target.value)}
      />
      <button disabled={!isValid.value}>Submit</button>
    </form>
  );
});
```

## Gotchas

### Always Wrap Components That Read Signals

```tsx
import { createSignal, reactor } from '@signalis/react';

const count = createSignal(0);

// ❌ Won't re-render
const Counter = () => {
  return <div>{count.value}</div>;
};

// ✅ Will re-render
const BetterCounter = reactor(() => {
  return <div>{count.value}</div>;
});
```

### Don't Conditionally Apply reactor

```tsx
// ❌ Wrong
const Counter = ({ useReactor }: { useReactor: boolean }) => {
  const Component = () => <div>{count.value}</div>;
  return useReactor ? reactor(Component)() : <Component />;
};

// ✅ Correct
const CounterInner = () => <div>{count.value}</div>;
const Counter = reactor(CounterInner);
```

### Reading Signals in Event Handlers

Event handlers run outside the render context, so signal reads in them are **not tracked**:

```tsx
import { useSignal, reactor } from '@signalis/react';

const App = reactor(() => {
  const count = useSignal(0);

  const handleClick = () => {
    // This read is not tracked (it's in a callback)
    console.log(count.value);
    count.value++;
  };

  return (
    <div>
      {/* This read IS tracked (it's during render) */}
      <p>Count: {count.value}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  );
});
```

## See Also

- [useSignal](/react/use-signal) - Creating signals in components
- [useDerived](/react/use-derived) - Creating derived values in components
- [Core Concepts](/guide/core-concepts) - Understanding reactivity
- [Examples](/examples/stopwatch) - Complete examples
