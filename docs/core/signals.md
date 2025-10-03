# Signals

Signals are the core unit of reactivity in Signalis. A `Signal` is simply a box around a value that notifies other parts of the system when its value has changed.

## Key Characteristics

- **Writable**: Can be both read and updated
- **Lazy notifications**: Changing a signal doesn't trigger computations immediately
- **Equality checking**: Uses `===` by default to determine if the value actually changed
- **Customizable**: Can provide custom equality functions

## Creating Signals

### Basic Signal

```typescript
import { createSignal } from '@signalis/core';

const count = createSignal(0);
const list = createSignal(['foo', 'bar', 'baz']);
const user = createSignal({ firstName: 'Jane', lastName: 'Doe' });
```

### Reading Values

```typescript
const count = createSignal(0);
console.log(count.value); // 0
```

### Updating Values

```typescript
const count = createSignal(0);
count.value = 1;
count.value++; // Also works
```

## API Reference

### `createSignal<T>(value: T, isEqual?: false | (old: T, new: T) => boolean): Signal<T>`

Creates a signal with an initial value and optional equality function.

**Parameters:**

- `value`: The initial value
- `isEqual` (optional): Equality function or `false` to always notify

**Returns:** A `Signal<T>` with a `value` property

**Example:**

```typescript
const count = createSignal(0);
```

### `createSignal(): Signal<unknown>`

Creates a notifier signal that always notifies on updates, regardless of value.

**Returns:** A `Signal<unknown>` that notifies on every update

**Example:**

```typescript
const notifier = createSignal();

notifier.value = null; // Notifies dependents
notifier.value = null; // Notifies again (even though value didn't change)
```

## Working with Objects and Arrays

Since signals use `===` equality by default, object and array updates need to be immutable:

```typescript
const user = createSignal({ firstName: 'Jane', lastName: 'Doe' });

// ✅ Correct: Create a new object
user.value = {
  ...user.value,
  firstName: 'Janet',
};

// ❌ Wrong: Mutating the object won't trigger notifications
user.value.firstName = 'Janet'; // Doesn't work!
```

## Custom Equality Functions

You can provide a custom equality function to change how signals determine when they've changed:

```typescript
import { isEqual } from 'lodash';

const user = createSignal(
  {
    firstName: 'Jane',
    lastName: 'Doe',
  },
  isEqual,
);

// Now you can mutate and it will detect deep equality
const current = user.value;
current.firstName = 'Janet';
user.value = current; // Triggers update because deep equality check fails
```

### Always Notify

Set the equality function to `false` to make a signal always notify, regardless of value:

```typescript
const alwaysNotify = createSignal(0, false);

alwaysNotify.value = 1; // Notifies
alwaysNotify.value = 1; // Notifies again
alwaysNotify.value = 1; // Keeps notifying
```

## Common Patterns

### Counter

```typescript
const count = createSignal(0);

const increment = () => count.value++;
const decrement = () => count.value--;
const reset = () => (count.value = 0);
```

### Toggle

```typescript
const isOpen = createSignal(false);

const toggle = () => (isOpen.value = !isOpen.value);
const open = () => (isOpen.value = true);
const close = () => (isOpen.value = false);
```

### List Management

```typescript
const items = createSignal<Array<string>>([]);

const addItem = (item: string) => {
  items.value = [...items.value, item];
};

const removeItem = (index: number) => {
  items.value = items.value.filter((_, i) => i !== index);
};

const clearItems = () => {
  items.value = [];
};
```

## Notifier Pattern

For cases where you only care about the change event, not the value:

```typescript
const refreshTrigger = createSignal();

createEffect(() => {
  refreshTrigger.value; // Just read it to create dependency
  fetchData(); // This runs whenever refreshTrigger changes
});

// Trigger a refresh
const refresh = () => {
  refreshTrigger.value = null; // Value doesn't matter
};
```

## Type Safety

Signals are fully type-safe in TypeScript:

```typescript
const count = createSignal(0); // Signal<number>
const name = createSignal('Jane'); // Signal<string>
const user = createSignal({ name: 'Jane' }); // Signal<{ name: string }>

count.value = 'hello'; // ❌ Type error
name.value = 42; // ❌ Type error
```

## Gotchas

### Don't Mutate Objects

```typescript
const state = createSignal({ count: 0 });

// ❌ This won't trigger updates
state.value.count++;

// ✅ Do this instead
state.value = { ...state.value, count: state.value.count + 1 };

// Or consider using a Store for nested state
```

### Reading in Loops

Each read of `.value` tracks a dependency:

```typescript
const count = createSignal(0);

createEffect(() => {
  // Reading multiple times is fine, but unnecessary
  console.log(count.value);
  console.log(count.value);
  console.log(count.value);

  // Better to read once
  const value = count.value;
  console.log(value);
  console.log(value);
  console.log(value);
});
```

## Type Guard

Use `isSignal()` to check if a value is a signal:

```typescript
import { isSignal } from '@signalis/core';

const count = createSignal(0);
const value = 42;

isSignal(count); // true
isSignal(value); // false
```

## See Also

- [Derived](/core/derived) - Computed values based on signals
- [Effects](/core/effects) - Side effects that react to signal changes
- [Stores](/core/stores) - Alternative for nested object state
- [Utilities](/core/utilities) - Helper functions like `batch()`
