# useSignal

The `useSignal` hook creates a signal that persists across component re-renders, similar to React's `useState`.

## Signatures

```ts
function useSignal<T>(initializer: () => T): Signal<T>;
function useSignal(value?: null | undefined): Signal<unknown>;
function useSignal<T extends {}>(value: T): Signal<T>;
```

## Basic Usage

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = () => {
  const count = useSignal(0);

  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
      <button onClick={() => count.value--}>Decrement</button>
    </div>
  );
};

export default reactor(Counter);
```

## Lazy Initialization

For expensive initial values, use a function initializer:

```tsx
import { useSignal, reactor } from '@signalis/react';

const DataProcessor = reactor(() => {
  // ✅ Expensive computation only runs once
  const data = useSignal(() => processLargeDataset());

  return <div>Processed: {data.value.length} items</div>;
});
```

**Note:** Functions are always treated as initializers (matching React's `useState` pattern).

## Comparison with useState

### Traditional useState

```tsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount((c) => c + 1)}>+ (functional)</button>
    </div>
  );
}
```

### With useSignal

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(0);

  return (
    <div>
      <p>{count.value}</p>
      <button onClick={() => count.value++}>+</button>
      <button onClick={() => count.value++}>+ (same syntax)</button>
    </div>
  );
});
```

## Use Cases

### Form Inputs

```tsx
import { useSignal, reactor } from '@signalis/react';
import { FormEvent } from 'react';

const LoginForm = reactor(() => {
  const email = useSignal('');
  const password = useSignal('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login(email.value, password.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email.value} onChange={(e) => (email.value = e.target.value)} />
      <input
        type="password"
        value={password.value}
        onChange={(e) => (password.value = e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
});
```

### Toggle State

```tsx
import { useSignal, reactor } from '@signalis/react';
import { ReactNode } from 'react';

const Expandable = reactor(({ children }: { children: ReactNode }) => {
  const isOpen = useSignal(false);

  return (
    <div>
      <button onClick={() => (isOpen.value = !isOpen.value)}>
        {isOpen.value ? 'Collapse' : 'Expand'}
      </button>
      {isOpen.value && <div>{children}</div>}
    </div>
  );
});
```

### List Management

```tsx
import { useSignal, reactor } from '@signalis/react';

const TodoList = reactor(() => {
  const todos = useSignal<Array<string>>([]);
  const input = useSignal('');

  const addTodo = () => {
    if (input.value.trim()) {
      todos.value = [...todos.value, input.value];
      input.value = '';
    }
  };

  const removeTodo = (index: number) => {
    todos.value = todos.value.filter((_, i) => i !== index);
  };

  return (
    <div>
      <input
        value={input.value}
        onChange={(e) => (input.value = e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && addTodo()}
      />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.value.map((todo, i) => (
          <li key={i}>
            {todo}
            <button onClick={() => removeTodo(i)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
});
```

## Inside vs Outside Components

### Inside Component (useSignal)

Signal is local to the component instance:

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(0); // New signal per component instance

  return <div>{count.value}</div>;
});

// Each Counter has its own count
<>
  <Counter /> {/* count = 0 */}
  <Counter /> {/* count = 0 (different signal) */}
</>;
```

### Outside Component (createSignal)

Signal is shared across all instances:

```tsx
import { createSignal, reactor } from '@signalis/react';

const sharedCount = createSignal(0);

const Counter = reactor(() => {
  return <div>{sharedCount.value}</div>;
});

// All Counters share the same count
<>
  <Counter /> {/* Shows shared count */}
  <Counter /> {/* Shows same shared count */}
</>;
```

## Persisting Across Renders

`useSignal` uses `useMemo` internally to ensure the signal is only created once:

```tsx
import { useSignal, reactor } from '@signalis/react';

const Component = reactor(() => {
  const count = useSignal(0);
  // Same signal instance across all renders

  console.log('Rendering...');

  return (
    <div>
      <p>{count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
});
```

## TypeScript

`useSignal` is fully type-safe:

```tsx
import { useSignal, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(0); // Signal<number>
  const name = useSignal('Jane'); // Signal<string>
  const user = useSignal({ name: 'Jane', age: 30 }); // Signal<{ name: string; age: number }>

  count.value = 'hello'; // ❌ Type error
  name.value = 42; // ❌ Type error
  user.value = { name: 'Jane' }; // ❌ Type error (missing age)
});
```

## Common Patterns

### Derived State

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const ShoppingCart = reactor(() => {
  const items = useSignal<Array<{ price: number; quantity: number }>>([]);
  const total = useDerived(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  return (
    <div>
      <p>Total: ${total.value.toFixed(2)}</p>
    </div>
  );
});
```

### Validation

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const Form = reactor(() => {
  const email = useSignal('');
  const isValid = useDerived(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value));

  return (
    <div>
      <input value={email.value} onChange={(e) => (email.value = e.target.value)} />
      {!isValid.value && email.value && <p>Invalid email</p>}
    </div>
  );
});
```

## Gotchas

### Don't Destructure

```tsx
// ❌ Wrong - loses reactivity
const { value } = useSignal(0);

// ✅ Correct - keep the signal
const count = useSignal(0);
const value = count.value; // Read when needed
```

### Immutable Updates for Objects

```tsx
const user = useSignal({ name: 'Jane', age: 30 });

// ❌ Won't trigger updates
user.value.name = 'Janet';

// ✅ Create new object
user.value = { ...user.value, name: 'Janet' };
```

### Function Initialization

```tsx
// ❌ This treats the function as an initializer
const fn = useSignal(() => console.log('hello'));
// fn.value is undefined (return value of the function)

// ✅ Wrap it if you want to store a function
const fn = useSignal(() => () => console.log('hello'));
// fn.value is the function
```

## See Also

- [reactor](/react/reactor) - Making components reactive
- [useDerived](/react/use-derived) - Computed values
- [useSignalEffect](/react/use-signal-effect) - Effects with signals
- [Signals](/core/signals) - Understanding signals
