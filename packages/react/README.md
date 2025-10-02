# `@signalis/react`

`@signalis/react` is the React integration library for `signalis`. It provides a Higher-Order Component that can be used to integrate React components with Signalis' reactivity system. In addition, `@signalis/react` provides a set of hooks for creating reactive entities inside of React components in a way that integrates tightly with React's rendering cycle. Finally, as a convenience, `@signalis/react` also re-exports all of `@signalis/core`, if you're using `signalis` in a React app, you can just install `@signalis/react` and get access to the entirety of `signalis`.

## `reactor`

`reactor` is the main integration point for `@signalis/react`. Use `reactor` to wrap any component that you want to rerender in response to changes in reactive values.

```jsx
const count = createSignal(0);

const Counter = () => {
  return (
    <div>
      <span>Count: {count.value}</span>
      <button type="button" onClick={() => count.value++}>
        +
      </button>
      <button type="button" onClick={() => count.value--}>
        -
      </button>
    </div>
  );
};

export default reactor(Counter);
```

`reactor` works by wrapping the component passed to it in a `Proxy` that that tells the component to re-render any time any reactive value used inside the component updates. Since it returns a `Proxy`, the component should still share all the same properties that the base component does, which means it should show up in React DevTools the same way it would normally.

## `useSignal`

`useSignal` is a React hook for creating a `Signal` inside of a React component. It has the following signatures:

```ts
useSignal(value?: null | undefined): Signal<unknown>;
useSignal<T extends {}>(value: T): Signal<T>;
```

`useSignal` will return a `Signal` just like `createSignal` does, except that it uses `useMemo` under the hood to persist the `Signal` throughout component re-renders.

```jsx
const Counter = () => {
  // Since we use `useMemo` under the hood, the Signal returned here will only be created once and is then re-used in subsequent rerenders.
  const count = useSignal(0);

  return (
    <div>
      <span>Count: {count.value}</span>
      <button type="button" onClick={() => count.value++}>
        +
      </button>
      <button type="button" onClick={() => count.value--}>
        -
      </button>
    </div>
  );
};

export default reactor(Counter);
```

## `useDerived<T>(fn: () => T, deps?: DependencyList): Derived<T>`

Similar to `useSignal`, `useDerived` is used to create a `Derived` inside of a React component. `useDerived` uses `useRef` and `useMemo` to ensure that the underlying `Derived` is only created once and is then re-used on subsequent rerenders.

### Basic Usage

```jsx
const Counter = () => {
  const count = useSignal(0);
  const isOdd = useDerived(() => count.value % 2 !== 0);

  return (
    <div>
      <span>Count: {count.value}</span>
      <span>The count is {isOdd.value ? 'odd' : 'even'}</span>
      <button type="button" onClick={() => count.value++}>
        +
      </button>
      <button type="button" onClick={() => count.value--}>
        -
      </button>
    </div>
  );
};

export default reactor(Counter);
```

### Mixed Dependencies

When your derived computation depends on both signals and non-signal values (like props, `useState`, or `useContext`), you must pass those non-signal values in the `deps` array. The derived will recreate when the deps change, and signal reactivity will continue to work automatically.

```jsx
const ProductPrice = ({ taxRate }) => {
  const price = useSignal(100);
  const total = useDerived(() => price.value * (1 + taxRate), [taxRate]);
  // Updates when taxRate prop OR price signal changes

  return (
    <div>
      <div>Price: ${price.value}</div>
      <div>Tax Rate: {taxRate * 100}%</div>
      <div>Total: ${total.value}</div>
      <button onClick={() => (price.value += 10)}>Increase Price</button>
    </div>
  );
};

export default reactor(ProductPrice);
```

**Important:** Just like with `useEffect`, you must include all non-signal dependencies in the `deps` array. If you forget to include a prop, state, or context value that your derived uses, it will have a stale closure and won't see updates to that value.

```jsx
// ✅ Good: All non-signal dependencies listed
const total = useDerived(() => price.value * taxRate, [taxRate]);

// ✅ Also good: Signal-only derivations don't need deps
const doubled = useDerived(() => count.value * 2);

// ❌ Bad: Missing taxRate in deps - will use stale taxRate
const total = useDerived(() => price.value * taxRate); // taxRate never updates!
```

## `useSignalEffect(fn: () => void | (() => void), deps?: DependencyList): void`

`useSignalEffect` is a hook that allows you to create reactive effects inside of React components. It functions similarly to `useEffect` except that it automatically tracks any signal dependencies and will recompute whenever they change. `useSignalEffect` uses `useEffect` under the hood and returns the underlying effect's cleanup function so it will be automatically cleaned up the same way a regular `useEffect` will.

### Basic Usage

```jsx
const Counter = () => {
  const count = useSignal(0);
  const isOdd = useDerived(() => count.value % 2 !== 0);

  useSignalEffect(() => {
    // Runs on mount and whenever isOdd changes
    console.log(`The count is ${isOdd.value ? 'odd' : 'even'}`);
  });

  return (
    <div>
      <span>Count: {count.value}</span>
      <span>The count is {isOdd.value ? 'odd' : 'even'}</span>
      <button type="button" onClick={() => count.value++}>
        +
      </button>
      <button type="button" onClick={() => count.value--}>
        -
      </button>
    </div>
  );
};

export default reactor(Counter);
```

### Mixed Dependencies

When your effect depends on both signals and non-signal values (like props, `useState`, or `useContext`), you must pass those non-signal values in the `deps` array, just like with `useEffect`. The effect will recreate when the deps change, and signal reactivity will continue to work automatically.

```jsx
const UserProfile = ({ userId }) => {
  const refreshCount = useSignal(0);

  useSignalEffect(() => {
    // Effect runs when:
    // 1. Component mounts
    // 2. userId prop changes (via deps array)
    // 3. refreshCount signal changes (via signal reactivity)
    fetchUserData(userId, refreshCount.value);
  }, [userId]); // Must include userId in deps!

  return (
    <div>
      <button onClick={() => refreshCount.value++}>Refresh</button>
    </div>
  );
};

export default reactor(UserProfile);
```

**Important:** Just like with `useEffect`, you must include all non-signal dependencies in the `deps` array. If you forget to include a prop, state, or context value that your effect uses, it will have a stale closure and won't see updates to that value.

```jsx
// ✅ Good: All non-signal dependencies listed
useSignalEffect(() => {
  api.call(userId, apiKey, count.value);
}, [userId, apiKey]);

// ✅ Also good: Signal-only effects don't need deps
useSignalEffect(() => {
  console.log(count.value);
}); // Defaults to [] (runs once on mount, then whenever signals change)

// ❌ Bad: Missing userId in deps - will use stale userId
useSignalEffect(() => {
  fetchUser(userId, count.value);
}); // userId never updates!
```
