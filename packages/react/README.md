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

## `useDerived<T>(fn: () => T): Derived<T>`

Similar to `useSignal`, `useDerived` is used to create a `Derived` inside of a React component. `useDerived` makes use of `useCallback` and `useMemo` to ensure that the underlying `Derived` is only created once and is then re-used on subsequent rerenders.

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

## `useSignalEffect(fn: () => void | (() => void)): void`

`useSignalEffect` is a hook that allows you to create reactive effects inside of React components. It functions similarly to `useEffect` except that automatically tracks any reactive dependencies and will recompute whenever they change. `useSignalEffect` uses `useEffect` under the hood and returns the underlying effect's cleanup function so it will be automatically cleaned up the same way a regular `useEffect` will.

```jsx
const Counter = () => {
  const count = useSignal(0);
  const isOdd = useDerived(() => count.value % 2 !== 0);

  useSignalEffect(() => {
    // will log every time `isOdd` changes, and will be cleaned up whenever this component is torn down.
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
