# Derived

A `Derived` is a readonly reactive value that is computed from one or more other reactive values. Derived values automatically update when their dependencies change and use smart recomputation to avoid unnecessary work.

## Key Characteristics

- **Readonly**: Cannot be directly updated (computed from other values)
- **Lazy**: Only recomputes when accessed, not when dependencies change
- **Smart**: Skips recomputation when dependencies haven't actually changed
- **Composable**: Can depend on signals, other derived values, or both

## Creating Derived Values

### Basic Usage

```typescript
import { createSignal, createDerived } from '@signalis/core';

const firstName = createSignal('Jane');
const lastName = createSignal('Doe');

const fullName = createDerived(() => `${firstName.value} ${lastName.value}`);

console.log(fullName.value); // 'Jane Doe'

firstName.value = 'Janet';
console.log(fullName.value); // 'Janet Doe'
```

## API Reference

### `createDerived<T>(fn: () => T): Derived<T>`

Creates a derived value that automatically recomputes when its dependencies change.

**Parameters:**

- `fn`: A pure function that reads reactive values and returns a computed result

**Returns:** A `Derived<T>` with a readonly `value` property

**Important:** The function should be pure (no side effects). Use [effects](/core/effects) for side effects.

## Composing Derived Values

Derived values can depend on other derived values:

```typescript
const firstName = createSignal('Jane');
const lastName = createSignal('Doe');

const fullName = createDerived(() => `${firstName.value} ${lastName.value}`);

const greeting = createDerived(() => `Hello, ${fullName.value}!`);

const yelledGreeting = createDerived(() => `${greeting.value.toUpperCase()}!!!!`);

console.log(yelledGreeting.value); // 'HELLO, JANE DOE!!!!'
```

## Smart Recomputation

Derived values are very clever about when they recompute. They use the following heuristic:

### 1. Direct Dependencies Changed?

If a direct dependency changed its value, recompute immediately.

### 2. Indirect Dependencies Changed?

If only indirect dependencies changed, check if direct dependencies actually need to recompute first.

### 3. Nothing Changed?

If neither direct nor indirect dependencies changed, return the cached value.

## Smart Recomputation Example

```typescript
const count = createSignal(1);

// Direct dependency on count
const isOdd = createDerived(() => count.value % 2 !== 0);

// Indirect dependency on count (through isOdd)
const oddOrEven = createDerived(() => {
  if (isOdd.value) {
    return 'odd';
  } else {
    return 'even';
  }
});

// Initial read
console.log(oddOrEven.value); // 'odd'

// Change count to another odd number
count.value = 3;

/**
 * When we read oddOrEven.value:
 * 1. oddOrEven knows count changed (indirect dependency)
 * 2. It asks isOdd to check if IT changed
 * 3. isOdd recomputes: 3 % 2 !== 0 → true (same as before!)
 * 4. isOdd tells oddOrEven: "I didn't actually change"
 * 5. oddOrEven skips recomputing and returns cached 'odd'
 */
console.log(oddOrEven.value); // 'odd' (no recomputation!)
```

This smart recomputation works recursively through entire chains of derived values!

## Lazy Evaluation

Derived values only recompute when accessed, not when their dependencies change:

```typescript
const count = createSignal(0);

const doubled = createDerived(() => {
  console.log('Computing doubled...');
  return count.value * 2;
});

count.value = 1; // No log (not accessed yet)
count.value = 2; // Still no log
count.value = 3; // Still nothing

console.log(doubled.value); // Logs: "Computing doubled..." then 6
// Only computed once, even though count changed 3 times!
```

## Dynamic Dependencies

Dependencies are tracked dynamically based on what gets read:

```typescript
const useMetric = createSignal(false);
const miles = createSignal(100);
const kilometers = createSignal(160);

const distance = createDerived(() => {
  if (useMetric.value) {
    return `${kilometers.value} km`;
  }
  return `${miles.value} mi`;
});

console.log(distance.value); // '100 mi'
// Currently depends on: useMetric, miles (NOT kilometers)

miles.value = 200; // This will cause recomputation
kilometers.value = 300; // This won't (not a dependency yet)

console.log(distance.value); // '200 mi'

useMetric.value = true;
console.log(distance.value); // '300 km'
// Now depends on: useMetric, kilometers (NOT miles)

miles.value = 150; // This won't cause recomputation anymore
kilometers.value = 250; // This will

console.log(distance.value); // '250 km'
```

## Common Patterns

### Filtering

```typescript
const items = createSignal(['apple', 'banana', 'cherry']);
const searchTerm = createSignal('');

const filteredItems = createDerived(() => {
  const term = searchTerm.value.toLowerCase();
  return items.value.filter((item) => item.toLowerCase().includes(term));
});
```

### Aggregation

```typescript
const numbers = createSignal([1, 2, 3, 4, 5]);

const sum = createDerived(() => numbers.value.reduce((acc, n) => acc + n, 0));

const average = createDerived(() => sum.value / numbers.value.length);
```

### Validation

```typescript
const email = createSignal('');

const isValidEmail = createDerived(() => {
  const value = email.value;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
});

const errorMessage = createDerived(() => (isValidEmail.value ? '' : 'Please enter a valid email'));
```

### Conditional Logic

```typescript
const isLoggedIn = createSignal(false);
const userName = createSignal('');
const guestName = createSignal('Guest');

const displayName = createDerived(() => (isLoggedIn.value ? userName.value : guestName.value));
```

## Performance Tips

### Avoid Heavy Computations

If a computation is expensive, derived values will still run it when needed. Consider memoization or breaking it into smaller derived values:

```typescript
// ❌ One expensive derived
const result = createDerived(() => {
  const processed = expensiveProcess(data.value);
  const filtered = expensiveFilter(processed);
  return expensiveTransform(filtered);
});

// ✅ Break it into steps
const processed = createDerived(() => expensiveProcess(data.value));
const filtered = createDerived(() => expensiveFilter(processed.value));
const result = createDerived(() => expensiveTransform(filtered.value));
// Now each step only reruns when needed
```

### Minimize Dependencies

Reading fewer signals means fewer potential recomputations:

```typescript
const user = createSignal({ name: 'Jane', age: 30, city: 'NYC' });

// ❌ Depends on entire user object
const greeting = createDerived(() => `Hello, ${user.value.name}`);

// ✅ Use a store or separate signals for fine-grained reactivity
const userName = createSignal('Jane');
const greeting = createDerived(() => `Hello, ${userName.value}`);
```

## Gotchas

### Don't Use Side Effects

Derived functions should be pure:

```typescript
// ❌ Wrong: Has side effects
const count = createSignal(0);
const doubled = createDerived(() => {
  console.log('Doubling...'); // Side effect!
  return count.value * 2;
});

// ✅ Correct: Use an effect for side effects
const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);

createEffect(() => {
  console.log('Doubled value:', doubled.value);
});
```

### Don't Forget to Read `.value`

```typescript
const count = createSignal(5);

// ❌ Wrong: Derived returns the signal, not its value
const doubled = createDerived(() => count * 2);

// ✅ Correct: Read the signal's value
const doubled = createDerived(() => count.value * 2);
```

### Conditional Dependencies

Be aware that dependencies can change:

```typescript
const condition = createSignal(true);
const a = createSignal(1);
const b = createSignal(2);

const result = createDerived(() => (condition.value ? a.value : b.value));

// Currently depends on: condition, a
// Changing b won't trigger a recomputation
// Until condition becomes false
```

## Type Guard

Use `isDerived()` to check if a value is derived:

```typescript
import { isDerived } from '@signalis/core';

const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);

isDerived(count); // false
isDerived(doubled); // true
```

## See Also

- [Signals](/core/signals) - Writable reactive values
- [Effects](/core/effects) - For side effects instead of values
- [Utilities](/core/utilities) - Helper functions for working with reactive primitives
- [Core Concepts](/guide/core-concepts) - Understanding lazy evaluation
