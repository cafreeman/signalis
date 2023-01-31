# `@signalis/core`

`signalis` is a lightweight library for reactivity influenced by [`@preact/signals`](https://preactjs.com/guide/v10/signals/), [`solidjs`](https://www.solidjs.com/), and [`reactively`](https://github.com/modderme123/reactively). It aims to expose a small set of highly composable, highly performant primitives for building reactive programs as simply as possible.

To that end, `signalis` exposes three core primitives: signals, derived values, and effects.

## Signals

Signals are the core unit of reactivity in `signalis` (and, frankly, most reactivity systems!). A `Signal` is simply a box around a value that tells other things when its value has changed. Whenever a `Signal` changes, any part of the reactivity system that relies on it will update accordingly _the next time that part of the system is accessed_. In other words, all parts of the system will be kept in sync lazily: changing the value of a `Signal` doesn't trigger any additional computations, it simply tells the parts of the system that care about the `Signal` that they will need to recompute _eventually_.

To create a `Signal`, use the `createSignal` function:

### `createSignal<T>(value: T, isEqual?: false | (old: T, new: T) => boolean): Signal<T>`

This is the form of `createSignal` that you will likely use more often than not. It accepts a value and (optionally) an equality function. By default, `Signal` will use `===` to determine when a particular `Signal`'s value has changed (and hence, when it needs to notify that it has updated), but you can provide your own equality function if you need to customize this behavior. Additonally, if you'd like to make the `Signal` _always_ notify when it's been, you can set the second argument to `false`.

```ts
// Basic usage
const count = createSignal(0);
const list = createSignal(['foo', 'bar', 'baz']);
const me = createSignal({ firstName: 'Chris', lastName: 'Freeman' });

// to read a signal, access its `value` property
count.value; // 0

// to update a signal, assign a new value to its `value` property
count.value = 1;

// Since signals use `===` equality, object and array updates need to be immutable
me.value = {
  ...me.value,
  firstName: 'Christopher',
};

// Pass a custom equality function to change how signals determine when they've changed
import { isEqual } from 'lodash/isEqual';
const meButMutable = createSignal(
  {
    firstName, 'Chris',
    lastName: 'Freeman'
  },
  isEqual
)
```

### `createSignal(): Signal<unknown>`

In some cases, you don't actually care about the value of a signal, but instead simply need a way to tell other parts of the system about a change. In those cases, this form of `createSignal` can make that process easier. Calling `createSignal` with no arguments will return a `Signal<unknown>` with its equality function set to `false` so that it will notify its dependencies every time `value` is set to a value.

```ts
const notifier = createSignal();

notifier.value = null; // will notify all dependents

notifier.value = null; // will notify again
```

## Derived

As you may have already realized, a `Signal` on its own isn't very useful without something that reacts to it. This is where `Derived` comes in. `Derived` is a _readonly_ reactive value that, as its name might suggest, is derived from one or more _other_ reactive values (which can be `Signal`s, other `Derived`, or a combination of both). The value of a `Derived` will update any time one of its dependents change, and it will also notify its own dependents whenever _it_ changes.

To create a `Derived`, use `createDerived`:

### `createDerived<T>(fn: () => T): T`

`createDerived` accepts a callback that reads one or more reactive values, does some computation with them, and returns the result. `createDerived` should _always_ be used to represent a reactive _value_, so it's important that the callback actually return something. Furthermore, the callback passed into `createDerived` should be a pure function (it shouldn't have any side effects). If you need to represent a reactive _function_, there's a different primitive for that (see `createEffect` below).

```ts
const firstName = createSignal('Chris');
const lastName = createSignal('Freeman');

const fullName = createDerived(() => `${firstName.value} ${lastName.value}`);

// Since Derived is a reactive value, you access its value the same way you would a Signal
fullName.value; // 'Chris Freeman'

// Derived can rely on other Derived
const fullNameBUTYELLING = createDerived(() => `${fullName.value.toUpperCase()}!!!!!!!!!!!!!`);

fullNameBUTYELLING.value; // 'CHRIS FREEMAN!!!!!!!!!!!!!'

// Setting the value of a Signal at the root of a chain of Derived will notify all of them that they may need to recompute
firstName.value = 'Christopher';

fullNameBUTYELLING.value; // 'CHRISTOPHER FREEMAN!!!!!!!!!!!!!'
```

In order to avoid doing any unnecessary work, `Derived` is very clever about when it should actually recompute. It will _never_ recompute just because one of its sources changed. Something else has to first try and read its `value` property before it will even consider recomputing. Once something does access its `value`, `Derived` follows the heuristic below to determine if it should actually recompute:

- Have any of its _direct_ dependencies changed?
  - If so, this is the most certain we can be that value of the `Derived` has also changed, so recompute immediately.
- Have any of its _indirect_ dependencies changed?
  - If so, we know that it's _possible_ we may need to recompute, but are not certain, so have our immediate dependencies look to see if _they_ need to recompute, and then decide what we should do
- If neither the direct or indirect dependencies have changed, don't recompute and instead just return the previous value.

Here's an example to help clarify further:

```ts
const count = createSignal(1);

// This will recompute whenever count changes
const countIsOdd = createDerived(() => count.value % 2 !=== 0);

// This will recompute whenever countIsOdd changes
const oddOrEven = createDerived(() => {
  if (countIsOdd.value) {
    return 'odd';
  } else {
    return 'even';
  }
})


// Trigger the `countIsOdd` computation since it has never been read before.
countIsOdd.value // true, since count.value === 1

// Trigger the `oddOrEven` computation since it *also* has never been run before. However, since `countIsOdd` has already been read, and `count` hasn't changed, `countIsOdd` does *not* recompute.
oddOrEven.value // 'odd', since countIsOdd.value === true


count.value = 3; // Set count to another odd number

/**
 * Read `oddOrEven` again. At this point, `countIsOdd` has not recomputed since nothing else has accessed its `value` property since we updated `count`.
 *
 * `oddOrEven` knows that it *might* need to recompute since `count` changed, but it's not certain since it doesn't depend directly on `count`, so we first
 * check to see `countIsOdd` should recompute.
 *
 * `countIsOdd` sees that its direct dependency (`count`) has changed, so it recomputes and but since its value is still `true`, it tells `oddOrEven` that not to recompute.
 *
 * `oddOrEven`, upon being told that its direct dependencies haven't changed, returns its previous value ('odd') and skips computing
 *
 */
oddOrEven.value // still 'odd', no need to recompute since we know `countIsOdd` hasn't changed
```

## Effects

While `Derived` is a reactive value, you can think of an effect as a reactive _function_. It reacts to changes the same way that `Derived` does, but rather than returning a value, it runs a computation. Unlike `Derived`, side effects are welcome (and, in fact, encouraged) in effects. `Effects` use the same heuristic as `Derived` for determining when to recompute, with the one exception that they evaluate their callback function eagerly, whereas `Derived` is lazy. (This makes sense when you consider that effects don't have values, and therefore there's no way to "read" it the way you would with a `Derived`).

Effects are useful any time you need to perform some kind of action in response to something else changing.

To create an effect, use `createEffect`:

### `createEffect(fn: () => void | (() => void)): () => void`

`createEffect` takes a callback that reads some number of reactive values and does something with them. The callback should not return a value (it _can_ return a value, but `signalis` won't do anything with it since effects aren't mean to represent values). `createEffect` returns a disposal function that can be called if/when you no longer need the effect anymore

By default, the disposal function will simply disable the effect and remove it from the reactivity tree, but you can also add additional cleanup behavior by return a function from the callback that contains whatever action you'd like to run when the effect is disposed.

Effects have a wide range of uses, let's take a look at a few examples.

In the most basic case, we simply set up an effect that runs every time a signal changes:

```ts
const count = createSignal(0);

createEffect(() => {
  console.log(`The value of count is: ${count.value}`);
});

// since effects are eager, we will immediately log

count.value = 1; // the effect logs 'The value of count is 1'
```

Effects can also respond to `Derived`, and will use the same logic as `Derived` when determining whether to recompute:

```ts
const count = createSignal(1);
const countIsOdd = createDerived(() => count.value % 2 !=== 0);

let message: string;

createEffect(() => {
  message = countIsOdd.value ? 'odd' : 'even';
});

console.log(message); // 'odd'

count.value = 2;

// effect recomputes since we've gone from odd to even
console.log(message); // 'even'

count.value = 4;

// effect does *not* recompute since we've gone from one even number to another
console.log(message) // 'even'
```

Since effects compute eagerly, it's important that we provide a way to clean them up in the event that we no longer need them. To do that, we can use the function `createEffect` returns:

```ts
const count = createSignal(0);

const dispose = createEffect(() => {
  console.log(`count.value is: ${count.value}`);

  return () => {
    console.log(`cleaning up! no more messages!`);
  };
}); // logs the count immediately

count.value = 1; // logs again

dispose(); // logs the clean up message

count.value = 2; // no log, since the effect is disposed now
```

Finally, we can return a function from the callback to customize our effect's cleanup behavior:

```ts
function createTimer() {
  const time = createSignal(0);

  let interval;

  const dispose = createEffect(() => {
    console.log(time.value);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      console.log('Stopped!');
    };
  });

  return {
    start() {
      interval = setInterval(() => {
        time.value++;
      });
    },
    stop() {
      dispose();
    },
  };
}

const timer = createTimer();

timer.start(); // effect starts logging every second, 1...2...3...4...etc.

timer.stop(); // interval gets cleared, the effect is cleaned up, and it logs 'Stopped!'
```

## Resources

A `Resource` is a reactive abstraction built to help developers incorporate asynchronous values into reactive systems. Signalis' `Resource` is heavily inspired by [resources in `SolidJS`](https://www.solidjs.com/docs/latest/api#createresource), though its API is quite a bit different.

`Resource` comes in two flavors:

- A standalone reactive async request
- A reactive async request that depends on another reactive value

A `Resource` exposes four pieces of state:

- `value`: `Signal<ValueType | undefined>` - The value of the most recent async request (this is the most up to date value)
- `last`: `ValueType | undefined` - The value of the previous run of the async request
- `loading`: `Signal<boolean>` - Whether or not the `Resource` is currently in the process of fetching
- `error`: `Signal<unknown>` - A `Signal` whose value will be populated with the contents of an error that is caught during the fetcher's execution.

### `createResource<ValueType>(fetcher: () => Promise<ValueType>): Resource<ValueType>`

The single argument version of `createResource` accepts a function that performs some kind of async operation and returns a `Promise`. When the `Resource` is created, it will invoke the `fetcher` function and then updates the `Resource`'s `value` property once the async request is complete. `Resource` also has a `refetch` method that will re-run the `fetcher` function and trigger updates to the `Resource`'s reactive properties accordingly

```ts
const postResource = createResource(() => fetch('myUrl.com').then((res) => res.json()));

let error = '';
let content = '';

if (postResource.loading.value) {
  content = 'loading';
} else if (postResource.error.value) {
  error = postResource.error.value;
} else {
  content = postResource.value;
}

// run the fetch request again
postResource.refetch();
```

### `createResource<SourceType, ValueType>(source: Signal<SourceType> | Derived<SourceType>, fetcher: (source: SourceType) => Promise<ValueType>): ResourceWithSource<ValueType, SourceType>`

The two-argument version of `createResource` allows you to designate a reactive value as a "source" for the fetcher function, and returns a `ResourceWithSource`. Rather than calling the `fetcher` immediately, a `ResourceWithSource` will fire the fetcher as long as the source value is not `null`, `undefined`, or `false`. If the source is truthy to begin with, the fetcher function will be fired as soon as it's create. `ResourceWithSource` will also re-fire the fetcher function any time the source value changes, updating its `value` property with the result and notifying any dependents of the change. The fetcher function passed to `ResourceWithSource` will receive the source value as an argument.

```ts
const pageNumber = createSignal(false);
const postResource = createResource((pageNumber: number) =>
  fetch(`api.com/posts/${pageNumber}`).then((res) => res.json())
);

// No HTTP request has happened yet since `pageNumber` is false.

pageNumber.value = 1;

// Now that pageNumber has been updated, `postResource` will make the HTTP request using the pageNumber and update its
// `value` property, notifying anything that depends on it.

let error = '';
let content = '';

if (postResource.loading.value) {
  content = 'loading';
} else if (postResource.error.value) {
  error = postResource.error.value;
} else {
  content = postResource.value;
}

// run the fetch request again
postResource.refetch();
```

## Utility functions

### `isSignal(v: any): v is Signal<unknown>`

Indicates whether or not the value passed in is a `Signal`.

### `isDerived(v: any): v is Derived<unknown>`

Indicates whether or not the value passed in is a `Derived`.
