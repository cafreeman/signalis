# React Integration

The `@signalis/react` package provides React-specific integrations for Signalis, including hooks and a Higher-Order Component for automatic re-rendering.

## Key Features

- **`reactor` HOC**: Automatically re-renders components when signals change
- **React Hooks**: `useSignal`, `useDerived`, `useSignalEffect` for component-scoped reactivity
- **Full Core Re-export**: All of `@signalis/core` is re-exported for convenience

## Quick Example

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = () => {
  const count = useSignal(0);

  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
};

export default reactor(Counter);
```

## Integration Approach

Signalis integrates with React in two ways:

### 1. Global Signals with reactor

Create signals outside components and use `reactor` to make components reactive:

```tsx
import { createSignal, reactor } from '@signalis/react';

// Signal lives outside the component
const count = createSignal(0);

const Counter = () => {
  return <div>{count.value}</div>;
};

export default reactor(Counter);
```

### 2. Component-Local Signals with Hooks

Create signals inside components using hooks:

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = () => {
  // Signal is created and persisted across renders
  const count = useSignal(0);

  return <div>{count.value}</div>;
};

export default reactor(Counter);
```

## Core Concepts

### The reactor HOC

The `reactor` Higher-Order Component wraps your component in a reactive context. It tracks signals read **during render** and re-renders when they change. Signal reads in event handlers or callbacks are not tracked.

```tsx
import { reactor } from '@signalis/react';

const MyComponent = () => {
  // Component implementation
};

export default reactor(MyComponent);
```

**Important:** Always wrap components with `reactor` if they read signal values!

### Hooks for Component State

Use Signalis hooks like you would React's built-in hooks:

- **`useSignal`**: Like `useState`, but returns a signal
- **`useDerived`**: Like `useMemo`, but returns a derived value
- **`useSignalEffect`**: Like `useEffect`, but tracks signals automatically

## React Hooks Available

### [useSignal](/react/use-signal)

Creates a signal that persists across component re-renders.

```tsx
const count = useSignal(0);
const name = useSignal(() => expensiveComputation());
```

### [useDerived](/react/use-derived)

Creates a derived value that persists across re-renders.

```tsx
const doubled = useDerived(() => count.value * 2);
const total = useDerived(() => price.value * (1 + taxRate), [taxRate]);
```

### [useSignalEffect](/react/use-signal-effect)

Creates an effect that automatically tracks signal dependencies.

```tsx
useSignalEffect(() => {
  console.log('Count changed:', count.value);
});
```

## Comparison with React State

### Traditional React

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  const doubled = useMemo(() => count * 2, [count]);

  useEffect(() => {
    console.log(`Count: ${count}`);
  }, [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

### With Signalis

```tsx
const Counter = () => {
  const count = useSignal(0);
  const doubled = useDerived(() => count.value * 2);

  useSignalEffect(() => {
    console.log(`Count: ${count.value}`);
  });

  return (
    <div>
      <p>Count: {count.value}</p>
      <p>Doubled: {doubled.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
};

export default reactor(Counter);
```

## Benefits

- **Less boilerplate**: No dependency arrays for signal-only dependencies
- **Mutable-looking updates**: `count.value++` instead of `setCount(c => c + 1)`
- **Fine-grained reactivity**: Only re-renders when used signals change
- **Composability**: Signals can be shared across components
- **Familiar patterns**: Similar to existing state management solutions

## Version Requirements

- **React**: 19.0 or higher
- **React DOM**: 19.0 or higher

## Next Steps

- [reactor HOC](/react/reactor) - Automatic re-rendering
- [useSignal](/react/use-signal) - Component-local signals
- [useDerived](/react/use-derived) - Computed values in components
- [useSignalEffect](/react/use-signal-effect) - Effects with automatic tracking
- [Examples](/examples/stopwatch) - See complete examples
