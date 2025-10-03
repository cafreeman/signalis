# Quick Start

Let's build a simple counter application to see Signalis in action. We'll show both vanilla JavaScript and React versions.

## Vanilla JavaScript Counter

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

// Create a signal to hold the count
const count = createSignal(0);

// Create a derived value that doubles the count
const doubled = createDerived(() => count.value * 2);

// Create an effect that logs whenever count or doubled changes
createEffect(() => {
  console.log(`Count: ${count.value}, Doubled: ${doubled.value}`);
});
// Immediately logs: "Count: 0, Doubled: 0"

// Update the count
count.value = 5;
// Logs: "Count: 5, Doubled: 10"

count.value = 10;
// Logs: "Count: 10, Doubled: 20"
```

### What's Happening?

1. **Signal Creation**: `createSignal(0)` creates a reactive value initialized to 0
2. **Derived Value**: `createDerived()` creates a computed value that automatically updates when `count` changes
3. **Effect**: `createEffect()` runs immediately and re-runs whenever any signal it reads changes
4. **Reactivity**: When we update `count.value`, the effect automatically re-runs with the new values

## React Counter

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = () => {
  // useSignal creates a signal that persists across renders
  const count = useSignal(0);

  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
      <button onClick={() => count.value--}>Decrement</button>
    </div>
  );
};

// Wrap with reactor to enable automatic re-rendering
export default reactor(Counter);
```

### What's Happening?

1. **Signal Creation**: `useSignal` creates a component-scoped signal that persists across renders
2. **Reading Values**: When we read `count.value` in JSX, the `reactor` HOC tracks the dependency
3. **Updating Values**: Clicking buttons updates the signal value
4. **Automatic Re-render**: The `reactor` HOC detects signal changes and re-renders the component

## Adding Derived Values

Let's enhance our counter with derived state:

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const Counter = () => {
  const count = useSignal(0);
  const doubled = useDerived(() => count.value * 2);
  const isEven = useDerived(() => count.value % 2 === 0);

  return (
    <div>
      <p>Count: {count.value}</p>
      <p>Doubled: {doubled.value}</p>
      <p>The count is {isEven.value ? 'even' : 'odd'}</p>
      <button onClick={() => count.value++}>Increment</button>
      <button onClick={() => count.value--}>Decrement</button>
    </div>
  );
};

export default reactor(Counter);
```

## Key Takeaways

- **Signals** store reactive values that can be read and written
- **Derived** values automatically recompute based on signals
- **Effects** run side effects in response to signal changes
- In React, wrap components with **`reactor`** to enable automatic re-rendering
- Use **`useSignal`** and **`useDerived`** hooks for React component state

## Next Steps

- [Learn Core Concepts](/guide/core-concepts) - Understand the push-pull model
- [Explore Core API](/core/) - Deep dive into signals, derived, and effects
- [React Integration](/react/) - Learn about React hooks and patterns
- [View Examples](/examples/stopwatch) - See more complete examples
