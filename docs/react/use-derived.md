# useDerived

The `useDerived` hook creates a derived value that persists across component re-renders, similar to React's `useMemo` but with automatic signal tracking.

## Signature

```ts
function useDerived<T>(fn: () => T, deps?: DependencyList): Derived<T>;
```

## Basic Usage

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(0);
  const doubled = useDerived(() => count.value * 2);
  const isEven = useDerived(() => count.value % 2 === 0);

  return (
    <div>
      <p>Count: {count.value}</p>
      <p>Doubled: {doubled.value}</p>
      <p>The count is {isEven.value ? 'even' : 'odd'}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
});
```

## Signal-Only Dependencies

When your derived value only depends on signals, no dependency array is needed:

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const App = reactor(() => {
  const firstName = useSignal('Jane');
  const lastName = useSignal('Doe');

  // No deps array needed - signal dependencies are tracked automatically
  const fullName = useDerived(() => `${firstName.value} ${lastName.value}`);

  return <div>{fullName.value}</div>;
});
```

## Mixed Dependencies

When depending on both signals AND non-signal values (props, `useState`, `useContext`), include non-signal values in the `deps` array:

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const ProductPrice = reactor(({ taxRate }: { taxRate: number }) => {
  const price = useSignal(100);

  // taxRate is a prop, so it goes in deps
  const total = useDerived(() => price.value * (1 + taxRate), [taxRate]);

  return (
    <div>
      <p>Price: ${price.value}</p>
      <p>Tax Rate: {taxRate * 100}%</p>
      <p>Total: ${total.value}</p>
      <button onClick={() => (price.value += 10)}>Increase Price</button>
    </div>
  );
});
```

## Comparison with useMemo

Signalis brings **fine-grained reactivity** to React. With chained derived values, React requires manual dependency tracking, while Signalis offers automatic tracking and direct mutations.

### Traditional React (Manual Dependencies)

```tsx
import { useState, useMemo } from 'react';

function TemperatureConverter() {
  const [celsius, setCelsius] = useState(0);
  const [fahrenheit, setFahrenheit] = useState(32);

  // Need to compute both from a common source to avoid sync issues
  const [inputValue, setInputValue] = useState(0);
  const [inputScale, setInputScale] = useState<'C' | 'F'>('C');

  const celsiusValue = useMemo(() => {
    if (inputScale === 'C') return inputValue;
    return ((inputValue - 32) * 5) / 9;
  }, [inputValue, inputScale]); // Must track BOTH!

  const fahrenheitValue = useMemo(() => {
    if (inputScale === 'F') return inputValue;
    return (inputValue * 9) / 5 + 32;
  }, [inputValue, inputScale]); // Must track BOTH again!

  const boilingPoint = useMemo(
    () => celsiusValue >= 100,
    [celsiusValue], // Depends on derived value
  );

  const freezingPoint = useMemo(
    () => celsiusValue <= 0,
    [celsiusValue], // More dependencies to track
  );

  const description = useMemo(() => {
    if (boilingPoint) return '🔥 Water is boiling!';
    if (freezingPoint) return '🧊 Water is freezing!';
    return '💧 Water is liquid';
  }, [boilingPoint, freezingPoint]); // Must list derived values!

  return (
    <div>
      <div>
        <label>Celsius:</label>
        <input
          type="number"
          value={celsiusValue.toFixed(1)}
          onChange={(e) => {
            setInputValue(parseFloat(e.target.value) || 0);
            setInputScale('C');
          }}
        />
      </div>
      <div>
        <label>Fahrenheit:</label>
        <input
          type="number"
          value={fahrenheitValue.toFixed(1)}
          onChange={(e) => {
            setInputValue(parseFloat(e.target.value) || 0);
            setInputScale('F');
          }}
        />
      </div>
      <p>{description}</p>
    </div>
  );
}
```

**Problems:**

- Need extra state (`inputValue`, `inputScale`) to avoid synchronization issues
- Each `useMemo` requires manual dependency arrays
- Chained computations require listing upstream derived values
- Verbose updates: must call setter functions and track which scale changed
- Easy to forget a dependency, causing stale UI

### With useDerived

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const TemperatureConverter = reactor(() => {
  const celsius = useSignal(0);

  // Derived values automatically track dependencies!
  const fahrenheit = useDerived(() => (celsius.value * 9) / 5 + 32);
  const boilingPoint = useDerived(() => celsius.value >= 100);
  const freezingPoint = useDerived(() => celsius.value <= 0);

  const description = useDerived(() => {
    if (boilingPoint.value) return '🔥 Water is boiling!';
    if (freezingPoint.value) return '🧊 Water is freezing!';
    return '💧 Water is liquid';
  });

  return (
    <div>
      <div>
        <label>Celsius:</label>
        <input
          type="number"
          value={celsius.value.toFixed(1)}
          onInput={(e) => (celsius.value = parseFloat(e.currentTarget.value) || 0)}
        />
      </div>
      <div>
        <label>Fahrenheit:</label>
        <input
          type="number"
          value={fahrenheit.value.toFixed(1)}
          onInput={(e) =>
            (celsius.value = (((parseFloat(e.currentTarget.value) || 0) - 32) * 5) / 9)
          }
        />
      </div>
      <p>{description.value}</p>
    </div>
  );
});
```

**Benefits:**

- **Single source of truth** - just store `celsius`, derive everything else
- **Zero dependency arrays** - dependencies tracked automatically
- **Direct mutations** - `celsius.value = x` instead of `setCelsius(x)`
- **Automatic propagation** - changing `celsius` flows through `fahrenheit` → `boilingPoint` → `freezingPoint` → `description`
- **Less boilerplate** - compare 40+ lines of React state management vs. 20 lines of Signalis

## Common Patterns

### Filtering

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const TodoList = reactor(() => {
  const todos = useSignal([
    { id: 1, text: 'Learn Signalis', done: false },
    { id: 2, text: 'Build app', done: false },
  ]);
  const filter = useSignal<'all' | 'active' | 'completed'>('all');

  const filteredTodos = useDerived(() => {
    switch (filter.value) {
      case 'active':
        return todos.value.filter((t) => !t.done);
      case 'completed':
        return todos.value.filter((t) => t.done);
      default:
        return todos.value;
    }
  });

  return (
    <div>
      <select value={filter.value} onChange={(e) => (filter.value = e.target.value as any)}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      <ul>
        {filteredTodos.value.map((todo) => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
});
```

### Validation

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const Form = reactor(() => {
  const email = useSignal('');
  const password = useSignal('');
  const confirmPassword = useSignal('');

  const emailError = useDerived(() =>
    email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value) ? 'Invalid email' : '',
  );

  const passwordError = useDerived(() =>
    password.value && password.value.length < 8 ? 'Password must be at least 8 characters' : '',
  );

  const confirmError = useDerived(() =>
    confirmPassword.value && password.value !== confirmPassword.value ? 'Passwords must match' : '',
  );

  const isValid = useDerived(
    () =>
      !emailError.value &&
      !passwordError.value &&
      !confirmError.value &&
      email.value &&
      password.value &&
      confirmPassword.value,
  );

  return (
    <form>
      <input value={email.value} onChange={(e) => (email.value = e.target.value)} />
      {emailError.value && <p>{emailError.value}</p>}

      <input
        type="password"
        value={password.value}
        onChange={(e) => (password.value = e.target.value)}
      />
      {passwordError.value && <p>{passwordError.value}</p>}

      <input
        type="password"
        value={confirmPassword.value}
        onChange={(e) => (confirmPassword.value = e.target.value)}
      />
      {confirmError.value && <p>{confirmError.value}</p>}

      <button disabled={!isValid.value}>Submit</button>
    </form>
  );
});
```

### Aggregation

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const ShoppingCart = reactor(() => {
  const items = useSignal([
    { name: 'Apple', price: 1.5, quantity: 3 },
    { name: 'Banana', price: 0.75, quantity: 5 },
  ]);

  const subtotal = useDerived(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  const tax = useDerived(() => subtotal.value * 0.1);
  const total = useDerived(() => subtotal.value + tax.value);

  return (
    <div>
      <p>Subtotal: ${subtotal.value.toFixed(2)}</p>
      <p>Tax: ${tax.value.toFixed(2)}</p>
      <p>Total: ${total.value.toFixed(2)}</p>
    </div>
  );
});
```

### With Props and Context

```tsx
import { useContext } from 'react';
import { useSignal, useDerived, reactor } from '@signalis/react';

const PriceDisplay = reactor(({ discount }: { discount: number }) => {
  const basePrice = useSignal(100);

  // discount is a prop, so it goes in deps
  const finalPrice = useDerived(() => basePrice.value * (1 - discount), [discount]);

  return <div>${finalPrice.value.toFixed(2)}</div>;
});

// With context
const ThemeAwareComponent = reactor(() => {
  const theme = useContext(ThemeContext);
  const count = useSignal(0);

  // theme from context, so it goes in deps
  const displayText = useDerived(() => `${theme.prefix}: ${count.value}`, [theme.prefix]);

  return <div>{displayText.value}</div>;
});
```

## Dependency Array Rules

### Signal-Only: No deps array

```tsx
// ✅ Good: Only signals, no deps needed
const result = useDerived(() => signal1.value + signal2.value);
```

### Mixed: Non-signals in deps

```tsx
// ✅ Good: prop in deps array
const result = useDerived(() => signal.value * prop, [prop]);

// ✅ Good: state and context in deps
const result = useDerived(
  () => signal.value + stateValue + contextValue,
  [stateValue, contextValue],
);
```

### Common Mistake: Missing deps

```tsx
// ❌ Bad: prop not in deps - stale closure!
const result = useDerived(() => signal.value * taxRate);
// When taxRate prop changes, this derived won't update!

// ✅ Correct
const result = useDerived(() => signal.value * taxRate, [taxRate]);
```

## TypeScript

`useDerived` infers return types:

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

const Counter = reactor(() => {
  const count = useSignal(0);

  const doubled = useDerived(() => count.value * 2); // Derived<number>
  const text = useDerived(() => `Count: ${count.value}`); // Derived<string>
  const obj = useDerived(() => ({ value: count.value })); // Derived<{ value: number }>
});
```

## Gotchas

### Don't Forget Non-Signal Deps

```tsx
import { useSignal, useDerived, reactor } from '@signalis/react';

// ❌ Wrong: prop not in deps
const Component = reactor(({ multiplier }: { multiplier: number }) => {
  const count = useSignal(0);
  const result = useDerived(() => count.value * multiplier);
  // multiplier changes won't be seen!
});

// ✅ Correct
const Component = reactor(({ multiplier }: { multiplier: number }) => {
  const count = useSignal(0);
  const result = useDerived(() => count.value * multiplier, [multiplier]);
});
```

### Don't Use for Side Effects

```tsx
import { useSignal, useDerived, useSignalEffect, reactor } from '@signalis/react';

// ❌ Wrong: Side effects in derived
const Component = reactor(() => {
  const count = useSignal(0);

  const result = useDerived(() => {
    console.log('Computing...'); // Side effect!
    return count.value * 2;
  });

  return <div>{result.value}</div>;
});

// ✅ Use useSignalEffect instead
const BetterComponent = reactor(() => {
  const count = useSignal(0);

  useSignalEffect(() => {
    console.log('Count changed:', count.value);
  });

  const result = useDerived(() => count.value * 2);

  return <div>{result.value}</div>;
});
```

## See Also

- [useSignal](/react/use-signal) - Creating signals
- [useSignalEffect](/react/use-signal-effect) - Side effects
- [Derived](/core/derived) - Understanding derived values
- [reactor](/react/reactor) - Making components reactive
