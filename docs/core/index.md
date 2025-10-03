# Core API Overview

The `@signalis/core` package provides the fundamental reactive primitives that power Signalis. These primitives are designed to be highly composable, performant, and easy to use.

## Primitives

### [Signals](/core/signals)

Writable reactive values that serve as the foundation of the reactivity system.

```typescript
import { createSignal } from '@signalis/core';

const count = createSignal(0);
count.value = 5; // Update the value
console.log(count.value); // Read the value: 5
```

### [Derived](/core/derived)

Readonly reactive computed values that automatically update when their dependencies change.

```typescript
import { createSignal, createDerived } from '@signalis/core';

const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);

console.log(doubled.value); // 0
count.value = 5;
console.log(doubled.value); // 10
```

### [Effects](/core/effects)

Reactive side-effect functions that run automatically when their dependencies change.

```typescript
import { createSignal, createEffect } from '@signalis/core';

const count = createSignal(0);
createEffect(() => {
  console.log(`Count is: ${count.value}`);
}); // Immediately logs: "Count is: 0"

count.value = 5; // Logs: "Count is: 5"
```

### [Resources](/core/resources)

Async reactive values with built-in loading and error states.

```typescript
import { createResource } from '@signalis/core';

const data = createResource(() => fetch('/api/data').then((res) => res.json()));

if (data.loading.value) {
  console.log('Loading...');
} else if (data.error.value) {
  console.log('Error:', data.error.value);
} else {
  console.log('Data:', data.value.value);
}
```

### [Stores](/core/stores)

Proxy-based fine-grained reactive objects for managing nested state.

```typescript
import { createStore, update } from '@signalis/core';

const store = createStore({
  count: 0,
  user: { name: 'Jane' },
});

// Read values directly (no .value needed!)
console.log(store.count); // 0

// Update using the update function
update(store, (draft) => {
  draft.count = 5;
  draft.user.name = 'Janet';
});
```

## Utilities

### [Utility Functions](/core/utilities)

Helper functions for working with reactive primitives:

- `batch()` - Batch multiple signal updates
- `isSignal()` - Type guard for signals
- `isDerived()` - Type guard for derived values
- `isReaction()` - Type guard for reactions

## Next Steps

- Explore each primitive in detail using the sidebar
- Check out [examples](/examples/stopwatch) to see them in action
- Learn about [React integration](/react/)
