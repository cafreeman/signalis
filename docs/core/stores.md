# Stores

Stores are proxy-based fine-grained reactive objects that provide an alternative to using signals for nested state. They eliminate the need to call `.value` repeatedly and provide fine-grained reactivity at the property level.

## Key Characteristics

- **Fine-grained**: Each property is independently reactive
- **Ergonomic**: No `.value` calls needed
- **Nested**: Supports deeply nested objects and arrays
- **Immutable updates**: Use `update()` function for changes
- **Method binding**: Automatically binds methods and getters

## Creating Stores

### Basic Store

```typescript
import { createStore } from '@signalis/core';

const store = createStore({
  count: 0,
  user: {
    name: 'Jane',
    email: 'jane@example.com',
  },
});

// Read values (no .value needed!)
console.log(store.count); // 0
console.log(store.user.name); // 'Jane'
```

## API Reference

### `createStore<T extends object>(v: T | Store<T>): Store<T>`

Creates a reactive store from an object or array.

**Parameters:**

- `v`: An object or array (or existing store)

**Returns:** A proxied version of the object with fine-grained reactivity

### `update<T extends object>(base: T, recipe: (draft: T) => void): T`

Updates a store using a recipe function.

**Parameters:**

- `base`: The store to update
- `recipe`: A function that receives a draft and makes changes

**Returns:** The updated store (for chaining, though mutation happens in-place)

**Important:** This is the ONLY way to update store values. Direct assignment will throw an error.

## Updating Stores

Stores cannot be mutated directly. Use the `update()` function:

```typescript
import { createStore, update } from '@signalis/core';

const store = createStore({
  count: 0,
  user: { name: 'Jane' },
});

// ❌ This throws an error
store.count = 5; // Error: Can't set properties directly on stores

// ✅ Use update() instead
update(store, (draft) => {
  draft.count = 5;
  draft.user.name = 'Janet';
});
```

## Fine-Grained Reactivity

Each property is independently reactive:

```typescript
import { createStore, update, createEffect } from '@signalis/core';

const store = createStore({
  firstName: 'Jane',
  lastName: 'Doe',
  age: 30,
});

// This effect only depends on firstName
createEffect(() => {
  console.log('First name:', store.firstName);
});

// This only triggers the effect
update(store, (draft) => {
  draft.firstName = 'Janet';
});

// This does NOT trigger the effect
update(store, (draft) => {
  draft.age = 31;
});
```

## Working with Arrays

Stores work great with arrays, both as properties of objects and as direct stores:

### Arrays as Store Properties

```typescript
const store = createStore({
  items: ['apple', 'banana', 'cherry'],
});

// Read array properties
console.log(store.items.length); // 3
console.log(store.items[0]); // 'apple'

// Update arrays
update(store.items, (draft) => {
  draft.push('date');
  draft[0] = 'apricot';
});

// Array methods work reactively
createEffect(() => {
  const count = store.items.length;
  console.log(`${count} items`);
});
```

### Direct Array Stores

You can also create a store directly from an array:

```typescript
const items = createStore(['apple', 'banana', 'cherry']);

// Read array properties
console.log(items.length); // 3
console.log(items[0]); // 'apple'

// Update the array directly
update(items, (draft) => {
  draft.push('date');
  draft[0] = 'apricot';
});

// Array methods work reactively
createEffect(() => {
  const count = items.length;
  console.log(`${count} items`);
});

// Array iteration works
items.forEach((item, index) => {
  console.log(`${index}: ${item}`);
});
```

## Getters and Methods

Stores automatically bind getters and methods to the proxy:

```typescript
const todoStore = createStore({
  todos: [] as Array<{ id: number; text: string; completed: boolean }>,

  // Getter - automatically computed
  get todoCount() {
    return this.todos.length;
  },

  get completedCount() {
    return this.todos.filter((t) => t.completed).length;
  },

  // Method - automatically bound
  addTodo(text: string) {
    update(this.todos, (draft) => {
      draft.push({
        id: Date.now(),
        text,
        completed: false,
      });
    });
  },

  toggleTodo(id: number) {
    update(this.todos, (draft) => {
      const todo = draft.find((t) => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    });
  },
});

// Use getters (they're reactive!)
createEffect(() => {
  console.log(`${todoStore.completedCount} of ${todoStore.todoCount} complete`);
});

// Call methods
todoStore.addTodo('Learn Signalis');
todoStore.toggleTodo(1);
```

## Common Patterns

### Encapsulation Pattern

Define methods directly on the store to encapsulate update logic. This keeps your business logic colocated with your data and provides a clean API.

```typescript
const store = createStore({
  count: 0,

  // Encapsulate update logic in methods
  increment() {
    update(this, (draft) => {
      draft.count++;
    });
  },

  reset() {
    update(this, (draft) => {
      draft.count = 0;
    });
  },
});

// Clean API for consumers
store.increment();
store.reset();
```

**When to use:** Always prefer methods over external update functions for better encapsulation and reusability.

### Computed Properties Pattern

Use getters to create derived reactive values within the store. These automatically track dependencies and only recompute when accessed.

```typescript
const store = createStore({
  items: [] as Array<{ price: number }>,
  taxRate: 0.08,

  // Computed property that depends on items and taxRate
  get total() {
    const subtotal = this.items.reduce((sum, item) => sum + item.price, 0);
    return subtotal * (1 + this.taxRate);
  },
});

// Accessing the getter establishes reactive dependencies
console.log(store.total); // Recomputes when items or taxRate change
```

**When to use:** For any derived state that depends on other store properties. Getters are lazy and only compute when accessed.

### Automatic Fine-Grained Reactivity Pattern

Stores provide automatic fine-grained reactivity regardless of where you start your update. Only the specific properties you change will notify their observers, even when updating from the root.

```typescript
const store = createStore({
  user: {
    profile: { name: 'Jane', email: 'jane@example.com' },
    settings: { theme: 'light', notifications: true },
  },
});

// Effect that only observes profile.name
createEffect(() => {
  console.log('Name changed:', store.user.profile.name);
});

// Effect that only observes settings.theme
createEffect(() => {
  console.log('Theme changed:', store.user.settings.theme);
});

// Update from the root, but only name observers are notified
update(store, (draft) => {
  draft.user.profile.name = 'Janet'; // Only first effect runs
});

// Update nested directly if you prefer - same result
update(store.user.settings, (draft) => {
  draft.theme = 'dark'; // Only second effect runs
});
```

**Why this works:** Fine-grained reactivity is determined by which signals your observers **read**, not by where you **start** your update. Each property gets its own signal node, so changing `profile.name` only notifies observers of that specific property.

**When to use:** This means you can update from wherever is most convenient (often the root) without worrying about performance. Choose the update scope that makes your code clearest.

### Array Method Pattern

Arrays in stores support all standard array methods within update callbacks. Use them naturally for more readable code.

```typescript
const store = createStore({
  todos: [] as Array<{ id: number; text: string }>,
});

update(store.todos, (draft) => {
  // Use array methods directly
  draft.push({ id: 1, text: 'New todo' });
  draft.splice(0, 1); // Remove first item
  draft.sort((a, b) => a.id - b.id);
});
```

**When to use:** Anytime you need to modify arrays. All mutations happen on the draft and are applied atomically.

### Partial Store Pattern

Pass sub-properties of a store to functions or components that only need access to part of the state.

```typescript
const appStore = createStore({
  user: { name: 'Jane', email: 'jane@example.com' },
  settings: { theme: 'dark' },
});

// Function that only needs settings
function updateTheme(settings: typeof appStore.settings, theme: string) {
  update(settings, (draft) => {
    draft.theme = theme;
  });
}

updateTheme(appStore.settings, 'light');
```

**When to use:** For better separation of concerns and to prevent functions from accessing more state than they need.

### Unwrap Pattern

Use `unwrap()` to get the raw, non-reactive version of a store when you need to serialize it or use it with APIs that don't work with Proxies.

```typescript
const store = createStore({
  user: { name: 'Jane', preferences: { theme: 'dark' } },
});

// Get raw object for serialization
const raw = unwrap(store);
const json = JSON.stringify(raw);

// Send to server or save to localStorage
localStorage.setItem('store', json);
```

**When to use:** When passing store data to JSON.stringify, external libraries, or any API that expects plain objects.

## Stores vs Signals

### When to Use Stores

- Deeply nested state
- Many related properties
- You want fine-grained reactivity
- Ergonomics matter (avoiding `.value`)

### When to Use Signals

- Simple values
- Top-level state
- When you need the signal object itself
- Interfacing with external libraries

### Comparison Example

```typescript
// With Signals
const state = createSignal({
  count: 0,
  name: 'Jane',
});

console.log(state.value.count); // Have to use .value
state.value = { ...state.value, count: 1 }; // Immutable update required
// Changing count triggers ALL observers, even if they only use name

// With Stores
const store = createStore({
  count: 0,
  name: 'Jane',
});

console.log(store.count); // No .value needed
update(store, (draft) => {
  draft.count = 1;
}); // Mutable-looking update
// Changing count only triggers observers that read count
```

## Performance

### Fine-Grained Updates

Stores only notify observers of the specific properties that changed:

```typescript
const store = createStore({
  a: 1,
  b: 2,
  c: 3,
});

createEffect(() => {
  console.log('A changed:', store.a);
});

createEffect(() => {
  console.log('B changed:', store.b);
});

update(store, (draft) => {
  draft.a = 10; // Only triggers first effect
});
```

### Lazy Wrapping

Properties are only wrapped in signals when first accessed:

```typescript
const store = createStore({
  used: 'value',
  unused: 'value',
});

// Only 'used' is wrapped in a signal so far
console.log(store.used);

// Now 'unused' gets wrapped too
console.log(store.unused);
```

## Gotchas

### Direct Assignment Throws

```typescript
const store = createStore({ count: 0 });

// ❌ Error!
store.count = 5;

// ✅ Use update
update(store, (draft) => {
  draft.count = 5;
});
```

### Getters Need `this`

Getters must use `this` to access other properties:

```typescript
const store = createStore({
  firstName: 'Jane',
  lastName: 'Doe',

  // ❌ Won't work - outer scope
  get fullName() {
    return `${store.firstName} ${store.lastName}`;
  },

  // ✅ Use this
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  },
});
```

## See Also

- [Signals](/core/signals) - Alternative for simple state
- [Update Function](/core/utilities) - Detailed update() documentation
- [Effects](/core/effects) - Reacting to store changes
- [Examples](/examples/todo-list) - Complete todo list example with stores
