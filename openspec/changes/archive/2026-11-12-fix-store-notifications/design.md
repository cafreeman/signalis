# Design

## Context

Each store object keeps a map of property signals (`$NODES`), created lazily by `getSignalNode`, plus an optional key-set signal under `$SELF`.

- **Property signals** are created with `createSignal(value, false)`, so every write notifies, changed or not.
- **The key-set signal** is created by `trackSelf`, which the `ownKeys` trap calls. `trackSelf` reads the signal (subscribing the running computation) only on the call that creates it. Later calls find it and return without reading, so they subscribe nothing. A computation that re-runs doesn't read it either, and `reconcileSources` then drops the edge.
- **`setProperty`** writes `$SELF` on every property write, whatever changed.

All store writes go through `setProperty`, from `update`'s draft proxy (`set` and `deleteProperty` traps). Writing `undefined` deletes the key. The store's own `set` trap throws.

## Goals / Non-Goals

**Goals:**

- Meet the `stores` spec in this change: property writes notify only on change, and key-set readers subscribe reliably and re-run only on key-set changes.

**Non-Goals:**

- Using `Object.is` instead of `===`. Plain signals use `===`, and stores match them.
- Notifying index readers when an array is truncated through `length`. That's a separate existing behavior. This change only guarantees that key-set readers see the length change.
- Reacting to mutations made directly on the object passed to `createStore`, which bypass `update`. Stores never supported that, and the change makes such writes no more or less visible.
- Creating fewer signals on untracked reads. That's a separate performance item.

## Decisions

### 1. Default equality for property signals

`getSignalNode` creates property signals with `createSignal(value)`, which uses `===`. The key-set signal keeps `createSignal()` (never equal), because it carries no value: every write to it is a notification.

- **Pinned by:** nothing in the current suite. With this change alone, every existing test passed in a prototype run.
- **Array `push`:** writing the new index already updates the `length` signal. The explicit `length` write that follows now finds an equal value and notifies nothing. Today it re-notifies; inside `update`'s batch that collapses to one run anyway, so effect counts don't change.

### 2. Subscribe on every key enumeration

`trackSelf` creates the key-set signal if it doesn't exist, then always reads it: `(nodes[$SELF] ??= createSignal()).value`.

### 3. Notify the key set only when it changes

`setProperty` writes `$SELF` only when the set of keys changed:

- the property went from absent to present, or the reverse (`Object.hasOwn` before and after the write), or
- the target is an array and its length changed.

**Why the array rule:** truncating through `length` removes index keys while `length` itself stays an own property, so checking only the written property would miss it. Comparing lengths, which `setProperty` already does to keep the `length` signal in sync, covers `push`, `pop`, `splice` and truncation.

**Alternative rejected:** comparing `Reflect.ownKeys` before and after. That's correct but costs O(keys) on every write.

## Risks / Trade-offs

- **[Code relied on same-value writes re-running effects]** → Marked **BREAKING** in the changeset, with the migration: write a new value or use a signal created with `isEqual: false`.
- **[Code relied on key readers re-running for value changes]** Code that calls `Object.keys(store)` and then reads values through the raw object, or through `untrack`, gets fewer runs. → Reads made through the store subscribe to each value, as `Object.entries` does. Called out in the changeset and docs.
- **[Array length edge cases]** → Add tests before changing `setProperty`, pinning today's behavior for key readers on `push`, `pop`, `splice`, truncation through `length`, and index deletion, and verify they still pass afterwards.

## Migration Plan

Ship as a `minor` changeset with **BREAKING** bullets (the project is pre-1.0). Rollback is a plain revert.
