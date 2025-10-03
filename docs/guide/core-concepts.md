# Core Concepts

Understanding how Signalis works under the hood will help you write more effective reactive code.

## The Push-Pull Model

Signalis uses a **push-pull model** for reactivity:

### Push Phase (Notifications)

When a signal changes:

1. The signal notifies its observers that they're potentially stale
2. Observers propagate this "dirty" notification to their observers
3. No computations actually run yet

### Pull Phase (Evaluation)

When you access a value:

1. The value checks if it needs to recompute
2. If needed, it pulls fresh values from its dependencies
3. The computation runs and returns the result

This model is powerful because:

- **Lazy**: No work is done until someone actually needs the value
- **Efficient**: Multiple changes to a signal only cause one recomputation
- **Predictable**: You control when computations happen by controlling when you read values

## Lazy Evaluation

One of Signalis' core principles is **lazy evaluation**. Derived values don't recompute just because a dependency changed—they only recompute when accessed.

```typescript
const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);

count.value = 1; // doubled doesn't recompute yet
count.value = 2; // still not recomputed
count.value = 3; // still waiting...

doubled.value; // NOW it computes: 6 (only once, despite 3 changes!)
```

To observe this behavior, you can use an effect:

```typescript
const count = createSignal(0);
let computeCount = 0;

const doubled = createDerived(() => {
  computeCount++; // Track computation (don't do this in real code!)
  return count.value * 2;
});

// Effect to log when derived is accessed
createEffect(() => {
  console.log(`Doubled: ${doubled.value}, Computed ${computeCount} times`);
});

count.value = 1; // Logs: "Doubled: 2, Computed 1 times"
count.value = 2; // Logs: "Doubled: 4, Computed 2 times"
// Each change triggers the effect, which reads doubled.value
```

This prevents unnecessary work when:

- Multiple signals change before a derived value is read
- A derived value isn't currently being used
- A change doesn't actually affect the final result

## Automatic Dependency Tracking

Signalis automatically tracks which signals and derived values each computation depends on:

```typescript
const firstName = createSignal('Jane');
const lastName = createSignal('Doe');
const useMiddleName = createSignal(false);
const middleName = createSignal('James');

const fullName = createDerived(() => {
  if (useMiddleName.value) {
    return `${firstName.value} ${middleName.value} ${lastName.value}`;
  }
  return `${firstName.value} ${lastName.value}`;
});

fullName.value; // Depends on: useMiddleName, firstName, lastName
// NOT dependent on middleName (wasn't read in this execution)

useMiddleName.value = true;
fullName.value; // Now depends on: useMiddleName, firstName, middleName, lastName
// Dependencies are tracked in the order they're accessed
```

Dependencies are **dynamic**—they change based on which values are actually accessed during computation.

## Smart Recomputation

Derived values use a smart heuristic to minimize unnecessary recomputation:

```typescript
const count = createSignal(1);
const isOdd = createDerived(() => count.value % 2 !== 0);
const oddOrEven = createDerived(() => (isOdd.value ? 'odd' : 'even'));

oddOrEven.value; // 'odd'

count.value = 3; // Another odd number

oddOrEven.value; // Still 'odd', but did isOdd recompute?
```

Here's what happens:

1. `oddOrEven` is marked as potentially stale
2. When accessed, it checks if `isOdd` actually changed
3. `isOdd` recomputes and gets `true` again (same as before)
4. `isOdd` tells `oddOrEven` "I didn't actually change"
5. `oddOrEven` skips recomputing and returns cached `'odd'`

This works recursively through chains of derived values!

## Effects Are Eager

Unlike derived values, **effects run immediately**:

```typescript
const count = createSignal(0);

createEffect(() => {
  console.log(`Count is ${count.value}`);
});
// Immediately logs: "Count is 0"

count.value = 1;
// Immediately logs: "Count is 1"
```

This makes sense because:

- Effects perform side effects (logging, DOM updates, API calls)
- Side effects need to happen at specific times, not lazily
- You can't "pull" a side effect—it must be pushed

## When to Use Each Primitive

### Use Signals When:

- You have a value that changes over time
- You need both read and write access
- The value is the source of truth

### Use Derived When:

- You need a computed value based on other reactive values
- The computation is pure (no side effects)
- You want automatic caching and smart recomputation

### Use Effects When:

- You need to perform side effects (DOM updates, logging, API calls)
- You want to react to changes eagerly
- You need to sync reactive state with non-reactive systems

### Use Resources When:

- You're working with async data (HTTP requests, database queries)
- You need loading and error states
- You want automatic refetching based on signal changes

### Use Stores When:

- You have deeply nested state
- You want fine-grained reactivity at the property level
- Calling `.value` everywhere becomes cumbersome

## Decision Tree

```
Do you need to perform side effects (DOM updates, logging, API calls)?
├─ Yes → Use Effect
└─ No (you need a value)
   ├─ Do you need async data (loading/error states)?
   │  └─ Yes → Use Resource
   └─ No (synchronous value)
      ├─ Is it computed from other reactive values?
      │  ├─ Yes → Use Derived
      │  └─ No (it's mutable state)
      │     ├─ Is it deeply nested object/array state?
      │     │  ├─ Yes → Use Store (fine-grained reactivity)
      │     │  └─ No → Use Signal
      └─ Static value → Use a regular constant
```

## Memory Management

Signalis automatically manages subscriptions:

- When a derived value or effect is disposed, it unsubscribes from its dependencies
- When a signal has no observers, it doesn't maintain any subscription overhead
- Effects return a disposal function for manual cleanup

```typescript
const count = createSignal(0);

const dispose = createEffect(() => {
  console.log(count.value);
});

// Later, when you no longer need the effect:
dispose();
```

## Next Steps

- [Signals API](/core/signals) - Deep dive into signals
- [Derived API](/core/derived) - Learn about computed values
- [Effects API](/core/effects) - Master side effects
- [Examples](/examples/stopwatch) - See concepts in action
