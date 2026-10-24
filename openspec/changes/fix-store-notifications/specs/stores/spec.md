# Spec Delta

## Purpose

Defines which writes made through `update` notify which readers of a store, so that stores re-run only the computations whose reads a write actually changed.

## ADDED Requirements

### Requirement: Property writes notify only on change

A write to a store property SHALL notify the computations that read that property only when the new value differs from the current one by strict equality (`===`). Replacing an object or array with a different object or array SHALL count as a change, even if the two are structurally equal.

#### Scenario: Writing the current value

- **WHEN** an effect reads `store.a`, which holds `1`, and an `update` writes `1` to `a`
- **THEN** the effect does not run again

#### Scenario: Writing a new value

- **WHEN** an effect reads `store.a`, which holds `1`, and an `update` writes `2` to `a`
- **THEN** the effect runs again once

#### Scenario: Replacing an object with an equal copy

- **WHEN** an effect reads `store.user`, and an `update` assigns a new object with the same properties to `user`
- **THEN** the effect runs again once

### Requirement: Enumerating keys subscribes to the key set

Every computation that enumerates the keys of a store object or array (with `Object.keys`, `Object.entries`, `for...in` or `Reflect.ownKeys`) SHALL be subscribed to that object's set of keys, and SHALL stay subscribed for as long as each of its runs enumerates them.

#### Scenario: Two computations enumerate the same object

- **WHEN** two effects each call `Object.keys(store)`, and an `update` adds a key to `store`
- **THEN** both effects run again once

#### Scenario: Subscription survives re-runs

- **WHEN** an effect calls `Object.keys(store)`, and two separate `update`s each add a key to `store`
- **THEN** the effect runs again after each update, three times in total

### Requirement: Key-set subscribers re-run only when the key set changes

A computation subscribed only to a store object's key set SHALL re-run when a key is added or deleted, and, for an array, when its length changes. It SHALL NOT re-run when a write changes the value of a key that already existed and the key set stays the same.

#### Scenario: Changing an existing value

- **WHEN** an effect only calls `Object.keys(store)`, and an `update` changes the value of an existing key
- **THEN** the effect does not run again

#### Scenario: Deleting a key

- **WHEN** an effect only calls `Object.keys(store)`, and an `update` deletes a key from `store`
- **THEN** the effect runs again once

#### Scenario: Array length changes

- **WHEN** an effect only calls `Object.keys(store.items)` on a store array, and an `update` pushes onto `items` or sets `items.length` to a smaller value
- **THEN** the effect runs again once per update

#### Scenario: Reading values as well as keys

- **WHEN** an effect calls `Object.entries(store)`, and an `update` changes the value of an existing key
- **THEN** the effect runs again once, because it read that value
