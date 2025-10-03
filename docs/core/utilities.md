# Utilities

Signalis provides several utility functions for working with reactive primitives.

## batch

Batches multiple signal updates into a single update cycle, preventing effects from running multiple times.

### Signature

```ts
function batch(cb: () => void): void;
```

### Usage

```typescript
import { createSignal, createEffect, batch } from '@signalis/core';

const firstName = createSignal('Jane');
const lastName = createSignal('Doe');

createEffect(() => {
  console.log(`Name: ${firstName.value} ${lastName.value}`);
});
// Logs: "Name: Jane Doe"

// Without batching - effect runs twice
firstName.value = 'Janet';
// Logs: "Name: Janet Doe"
lastName.value = 'Smith';
// Logs: "Name: Janet Smith"

// With batching - effect runs once
batch(() => {
  firstName.value = 'Jane';
  lastName.value = 'Doe';
});
// Logs once: "Name: Jane Doe"
```

### When to Use

- Updating multiple signals that share observers
- Performance optimization for bulk updates
- Ensuring consistency across multiple related updates

### Example: Form Submission

```typescript
const formData = {
  name: createSignal(''),
  email: createSignal(''),
  age: createSignal(0),
};

function submitForm(data: any) {
  batch(() => {
    formData.name.value = data.name;
    formData.email.value = data.email;
    formData.age.value = data.age;
  });
}
```

## Type Guards

### isSignal

Checks if a value is a Signal.

#### Signature

```ts
function isSignal(v: any): v is Signal<unknown>;
```

#### Usage

```typescript
import { createSignal, createDerived, isSignal } from '@signalis/core';

const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);
const value = 42;

isSignal(count); // true
isSignal(doubled); // false (it's a Derived, not a Signal)
isSignal(value); // false
```

### isDerived

Checks if a value is a Derived.

#### Signature

```ts
function isDerived(v: any): v is Derived<unknown>;
```

#### Usage

```typescript
import { createSignal, createDerived, isDerived } from '@signalis/core';

const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);
const value = 42;

isDerived(count); // false
isDerived(doubled); // true
isDerived(value); // false
```

### isReaction

Checks if a value is a Reaction.

#### Signature

```ts
function isReaction(v: any): v is Reaction;
```

#### Usage

```typescript
import { Reaction, isReaction } from '@signalis/core';

const reaction = new Reaction(() => {
  console.log('Reacting!');
});

isReaction(reaction); // true
isReaction({}); // false
```

## update

Updates a store using a recipe function. See [Stores](/core/stores) for detailed documentation.

### Signature

```ts
function update<T extends object>(base: T, recipe: (draft: T) => void): T;
```

### Usage

```typescript
import { createStore, update } from '@signalis/core';

const store = createStore({
  count: 0,
  user: { name: 'Jane' },
});

update(store, (draft) => {
  draft.count = 5;
  draft.user.name = 'Janet';
});
```

## Common Patterns

### Conditional Batching

```typescript
function updateMultiple(
  signals: Array<Signal<number>>,
  values: Array<number>,
  shouldBatch: boolean,
) {
  const updateFn = () => {
    signals.forEach((signal, i) => {
      signal.value = values[i];
    });
  };

  if (shouldBatch) {
    batch(updateFn);
  } else {
    updateFn();
  }
}
```

### Type-Safe Signal Processing

```typescript
function processReactiveValue(value: Signal<number> | Derived<number> | number): number {
  if (isSignal(value) || isDerived(value)) {
    return value.value;
  }
  return value;
}
```

### Generic Signal Handler

```typescript
function logReactiveValue(value: unknown) {
  if (isSignal(value)) {
    console.log('Signal value:', value.value);
  } else if (isDerived(value)) {
    console.log('Derived value:', value.value);
  } else {
    console.log('Static value:', value);
  }
}
```

## Performance Tips

### Batch Related Updates

```typescript
// ❌ Multiple effect runs
state.x.value = 1;
state.y.value = 2;
state.z.value = 3;

// ✅ Single effect run
batch(() => {
  state.x.value = 1;
  state.y.value = 2;
  state.z.value = 3;
});
```

### Nested Batching

Batches can be nested. The effects only run after the outermost batch completes:

```typescript
batch(() => {
  signal1.value = 1;

  batch(() => {
    signal2.value = 2;
    signal3.value = 3;
  });

  signal4.value = 4;
});
// Effects run once after everything completes
```

## See Also

- [Signals](/core/signals) - Understanding signals
- [Derived](/core/derived) - Understanding derived values
- [Stores](/core/stores) - Using the update() function
- [Effects](/core/effects) - Understanding when effects run
