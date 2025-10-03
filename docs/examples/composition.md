# Composition Example

Composing reactive primitives together to create reactive data flows and computation graphs.

## Reactive Pipelines

### Debounced Signal

Transforming one reactive value into another with delayed updates:

```typescript
import { createSignal, createEffect } from '@signalis/core';

function createDebouncedSignal<T>(source: { value: T }, delay: number) {
  const debounced = createSignal(source.value);

  createEffect(() => {
    const value = source.value;
    const timeoutId = setTimeout(() => {
      debounced.value = value;
    }, delay);

    return () => clearTimeout(timeoutId);
  });

  return debounced;
}

// Usage - reactive search pipeline
const searchQuery = createSignal('');
const debouncedQuery = createDebouncedSignal(searchQuery, 300);

createEffect(() => {
  if (debouncedQuery.value) {
    console.log('Searching for:', debouncedQuery.value);
    // fetch(`/api/search?q=${debouncedQuery.value}`)
  }
});

// User types rapidly
searchQuery.value = 'r';
searchQuery.value = 're';
searchQuery.value = 'rea';
searchQuery.value = 'react';
// Only logs once after 300ms: "Searching for: react"
```

### Throttled Signal

Another transformation pattern - limiting update frequency:

```typescript
import { createSignal, createEffect } from '@signalis/core';

function createThrottledSignal<T>(source: { value: T }, interval: number) {
  const throttled = createSignal(source.value);
  let lastUpdate = 0;

  createEffect(() => {
    const value = source.value;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate;

    if (timeSinceLastUpdate >= interval) {
      throttled.value = value;
      lastUpdate = now;
    } else {
      const timeoutId = setTimeout(() => {
        throttled.value = value;
        lastUpdate = Date.now();
      }, interval - timeSinceLastUpdate);

      return () => clearTimeout(timeoutId);
    }
  });

  return throttled;
}

// Usage - mouse position tracking
const mouseX = createSignal(0);
const mouseY = createSignal(0);

const throttledX = createThrottledSignal(mouseX, 100);
const throttledY = createThrottledSignal(mouseY, 100);

document.addEventListener('mousemove', (e) => {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
});

createEffect(() => {
  console.log(`Position: ${throttledX.value}, ${throttledY.value}`);
  // Only logs at most every 100ms
});
```

## Computation Graphs

### Derived Value Chains

Building reactive computation graphs where derived values depend on each other:

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

// Shopping cart computation graph
const cart = createSignal([
  { name: 'Widget', price: 10, quantity: 2 },
  { name: 'Gadget', price: 25, quantity: 1 },
]);

// First level derived values
const subtotal = createDerived(() =>
  cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
);

const taxRate = createSignal(0.08);

// Second level - depends on subtotal
const tax = createDerived(() => subtotal.value * taxRate.value);

const shippingFee = createDerived(() => (subtotal.value > 50 ? 0 : 5.99));

// Third level - depends on multiple derived values
const total = createDerived(() => subtotal.value + tax.value + shippingFee.value);

// React to the entire computation graph
createEffect(() => {
  console.log(`
    Subtotal: $${subtotal.value.toFixed(2)}
    Tax: $${tax.value.toFixed(2)}
    Shipping: $${shippingFee.value.toFixed(2)}
    Total: $${total.value.toFixed(2)}
  `);
});

// Any change propagates through the entire graph
cart.value = [...cart.value, { name: 'Doohickey', price: 15, quantity: 1 }];
// All derived values update automatically

taxRate.value = 0.1; // Changing tax rate updates tax and total
```

### Cross-Primitive Dependencies

Deriving values from multiple independent sources:

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

// Independent sources
const temperature = createSignal(72); // Fahrenheit
const humidity = createSignal(45); // Percent
const windSpeed = createSignal(5); // mph

// Compute heat index from multiple sources
const heatIndex = createDerived(() => {
  const t = temperature.value;
  const h = humidity.value;

  if (t < 80) return t;

  // Simplified heat index formula
  return t + 0.5 * (h / 100) * (t - 58);
});

// Compute comfort level from multiple derived values
const comfortLevel = createDerived(() => {
  const hi = heatIndex.value;
  const wind = windSpeed.value;

  if (hi < 75) return 'comfortable';
  if (hi < 85 && wind > 10) return 'comfortable';
  if (hi < 90) return 'caution';
  if (hi < 105) return 'extreme caution';
  return 'danger';
});

createEffect(() => {
  console.log(`
    Temperature: ${temperature.value}°F
    Humidity: ${humidity.value}%
    Wind: ${windSpeed.value} mph
    Heat Index: ${heatIndex.value.toFixed(1)}°F
    Comfort: ${comfortLevel.value}
  `);
});

temperature.value = 95; // Any weather change propagates through the computation graph
humidity.value = 60; // Updates heat index and comfort level
```

## Composing Multiple Primitives

### Form Validation

Composing multiple reactive primitives together:

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

// Individual field primitives (could be stores in real usage)
function createField<T>(initial: T, validator?: (value: T) => string) {
  const value = createSignal(initial);
  const touched = createSignal(false);

  const error = createDerived(() => {
    if (!touched.value || !validator) return '';
    return validator(value.value);
  });

  const isValid = createDerived(() => !error.value);

  return { value, error, isValid, touched };
}

// Compose multiple fields
const loginForm = {
  email: createField('', (v) =>
    !v ? 'Required' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email' : '',
  ),
  password: createField('', (v) => (!v ? 'Required' : v.length < 8 ? 'At least 8 characters' : '')),
};

// Derive form-level state from composed fields
const isFormValid = createDerived(
  () => loginForm.email.isValid.value && loginForm.password.isValid.value,
);

const formValues = createDerived(() => ({
  email: loginForm.email.value.value,
  password: loginForm.password.value.value,
}));

// React to form state changes
createEffect(() => {
  console.log('Form valid:', isFormValid.value);
  if (isFormValid.value) {
    console.log('Ready to submit:', formValues.value);
  }
});

// Touch fields to trigger validation
loginForm.email.touched.value = true;
loginForm.password.touched.value = true;

// Fill in the form
loginForm.email.value.value = 'user@example.com';
loginForm.password.value.value = 'securepass123';
// Logs: "Form valid: true" and "Ready to submit: ..."
```

### Coordinated State

Multiple primitives reacting to each other:

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

// Two independent counters
const clickCount = createSignal(0);
const keyPressCount = createSignal(0);

// Derived total activity
const totalActivity = createDerived(() => clickCount.value + keyPressCount.value);

// Derived activity rate (events per second)
const startTime = Date.now();
const activityRate = createDerived(() => {
  const elapsed = (Date.now() - startTime) / 1000;
  return totalActivity.value / elapsed;
});

// Effect coordinating multiple signals
createEffect(() => {
  if (totalActivity.value > 0 && totalActivity.value % 10 === 0) {
    console.log(`Milestone: ${totalActivity.value} total actions!`);
    console.log(`Rate: ${activityRate.value.toFixed(2)} actions/sec`);
  }
});

// Simulate activity
document.addEventListener('click', () => clickCount.value++);
document.addEventListener('keypress', () => keyPressCount.value++);
```

## React Integration

### Composing Signals in Components

```tsx
import { useSignal, useDerived, useSignalEffect, reactor } from '@signalis/react';

// Reactive data pipeline in React
const SearchComponent = reactor(() => {
  const query = useSignal('');
  const results = useSignal<Array<string>>([]);
  const isLoading = useSignal(false);

  // Debounce logic using useSignalEffect
  useSignalEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!query.value) {
        results.value = [];
        return;
      }

      isLoading.value = true;
      const response = await fetch(`/api/search?q=${query.value}`);
      results.value = await response.json();
      isLoading.value = false;
    }, 300);

    return () => clearTimeout(timeoutId);
  });

  // Derived UI state
  const statusMessage = useDerived(() => {
    if (isLoading.value) return 'Searching...';
    if (!query.value) return 'Type to search';
    if (results.value.length === 0) return 'No results';
    return `${results.value.length} results`;
  });

  return (
    <div>
      <input value={query.value} onChange={(e) => (query.value = e.target.value)} />
      <p>{statusMessage.value}</p>
      <ul>
        {results.value.map((result, i) => (
          <li key={i}>{result}</li>
        ))}
      </ul>
    </div>
  );
});
```

### Local Storage Sync

Composing effects with external state:

```tsx
import { useSignal, useSignalEffect, reactor } from '@signalis/react';

function useLocalStorage<T>(key: string, initial: T) {
  const value = useSignal<T>(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initial;
  });

  // Effect syncs signal with localStorage
  useSignalEffect(() => {
    localStorage.setItem(key, JSON.stringify(value.value));
  });

  return value;
}

const Preferences = reactor(() => {
  const theme = useLocalStorage('theme', 'light');
  const fontSize = useLocalStorage('fontSize', 16);

  return (
    <div>
      <select value={theme.value} onChange={(e) => (theme.value = e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <input
        type="range"
        min="12"
        max="24"
        value={fontSize.value}
        onChange={(e) => (fontSize.value = parseInt(e.target.value))}
      />
    </div>
  );
});
```

## Key Composition Patterns

### 1. Signal Transformation

Transform one reactive value into another:

```typescript
// ✅ Debounce, throttle, filter, map, etc.
const debounced = createDebouncedSignal(source, 300);
const filtered = createSignal(0);
createEffect(() => {
  if (source.value > 10) {
    filtered.value = source.value;
  }
});
```

### 2. Computation Graphs

Chain derived values together:

```typescript
// ✅ Each derived value depends on others
const subtotal = createDerived(() => sum(items.value));
const tax = createDerived(() => subtotal.value * taxRate.value);
const total = createDerived(() => subtotal.value + tax.value);
```

### 3. Multi-Source Derivation

Derive values from multiple independent sources:

```typescript
// ✅ Combines multiple reactive sources
const fullName = createDerived(() => `${firstName.value} ${lastName.value}`);
const heatIndex = createDerived(() => calculateHI(temp.value, humidity.value));
```

### 4. Effect Coordination

Effects that react to multiple signals:

```typescript
// ✅ Effect runs when any dependency changes
createEffect(() => {
  if (user.isLoggedIn.value && preferences.notifications.value) {
    subscribeToNotifications(user.id.value);
  }
});
```

## When to Use What

- **Signals**: Single reactive values
- **Stores**: Reactive objects (use instead of manually wrapping signals)
- **Derived**: Computed values from other reactive sources
- **Effects**: Side effects that react to changes
- **Composition**: Connecting these primitives in reactive data flows

## See Also

- [Core Concepts](/guide/core-concepts) - Understanding reactivity
- [Stores](/core/stores) - Reactive objects
- [Effects](/core/effects) - Reactive side effects
- [Derived](/core/derived) - Computed values
- [Signals](/core/signals) - Building blocks
