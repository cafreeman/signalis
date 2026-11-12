# Spec Delta

## Purpose

Defines precise reactive prototype-chain presence checks on stores, independently of property-value reads and own-key enumeration, for mutations made through `update`.

## ADDED Requirements

### Requirement: Presence checks preserve JavaScript presence semantics

For ordinary user keys on supported store objects and arrays, `in` and `Reflect.has` SHALL return the target's prototype-chain presence without reading the property's value or evaluating its getter. String and symbol keys SHALL follow the same rules.

#### Scenario: A getter is not evaluated

- **GIVEN** a store property whose getter increments a counter and throws if evaluated
- **WHEN** code checks that key with `in` or `Reflect.has`, inside or outside an effect
- **THEN** the check returns `true`, the getter counter remains zero, and no getter error is thrown

#### Scenario: An inherited key remains present after own-shadow deletion

- **GIVEN** a supported store root with an own key shadowing an inherited key, with inherited value either undefined or defined
- **WHEN** an `update` deletes the own key
- **THEN** `in` and `Reflect.has` still return `true`, regardless of own-property presence

### Requirement: Every presence reader remains subscribed

Every computation checking an ordinary key through `in` or `Reflect.has` SHALL subscribe to that object's presence of that key and remain subscribed while its runs keep checking it. A presence change SHALL invalidate a cached derived presence result as well as effects reading presence directly.

#### Scenario: Multiple readers observe undefined-key removal

- **GIVEN** a store with own `a: undefined`, two effects checking `'a' in store`, and an effect checking `Reflect.has(store, 'a')`
- **WHEN** one `update` deletes `a`, or separately assigns undefined to it
- **THEN** each effect's complete presence history is `[true, false]`

#### Scenario: Subscriptions survive consecutive changes

- **GIVEN** an initially absent key and independent presence readers
- **WHEN** separate updates add the key with `1`, delete it, add it with null, and delete it
- **THEN** every reader observes `[false, true, false, true, false]`

#### Scenario: A derived presence result is not stale

- **GIVEN** a derived value checking an own undefined-valued key, already read as `true`
- **WHEN** an `update` deletes the key and the derived is read again
- **THEN** it returns `false` rather than its cached `true`

#### Scenario: Function-valued keys are tracked

- **GIVEN** a store with a function-valued key and an effect checking only its presence
- **WHEN** separate updates delete and re-add that key
- **THEN** the effect observes `[true, false, true]` without reading or invoking the function

#### Scenario: Symbol and nested presence readers persist

- **GIVEN** two effects checking the same symbol key in a nested plain store object
- **WHEN** separate updates remove, add, and remove that key
- **THEN** both effects observe each boolean transition exactly once

#### Scenario: Replacing a containing object changes the observed presence

- **GIVEN** an effect checking `'a' in store.child`
- **WHEN** updates replace `child` with objects where `a` is present, absent, and present
- **THEN** the effect observes the corresponding booleans and tracks the replacement object

### Requirement: Presence-only invalidation is key-local and boolean-based

A computation whose only dependency on a store object is one key's presence SHALL NOT be invalidated when that boolean stays unchanged. Value-only writes, unrelated-key mutations, and no-op removals SHALL NOT notify that presence dependency. Separate mutations changing the boolean SHALL notify it even if a surrounding batch later restores the original result.

#### Scenario: Existing values change without a presence change

- **GIVEN** presence-only effects for existing defined, null, object, or array values
- **WHEN** updates perform equal-value writes, different-value writes, reference replacements, or NaN and signed-zero writes while keeping each key present
- **THEN** none of those writes re-runs the presence-only effects

#### Scenario: An absent key is removed again

- **GIVEN** an effect observing an absent key
- **WHEN** separate updates delete the key or assign undefined to it
- **THEN** its complete history remains `[false]`

#### Scenario: Another key changes structurally

- **GIVEN** an effect checking only key `a`
- **WHEN** separate updates add, change, and delete unrelated key `b`
- **THEN** the effect does not re-run

#### Scenario: Removing an own shadow does not change inherited presence

- **GIVEN** an effect checking a key that exists both as an own property and through the prototype chain
- **WHEN** an `update` removes only the own property
- **THEN** the presence-only effect does not re-run because its boolean remains `true`

### Requirement: Presence tracking preserves independent value and key observations

Presence tracking SHALL preserve the existing property-value and own-key notification contracts. Establishing presence subscriptions SHALL NOT change existing virtual-symbol presence results or add observable own keys to a store target.

#### Scenario: Undefined-key deletion affects presence and keys but not value

- **GIVEN** isolated effects reading presence, the property value, and `Object.keys` for own `a: undefined`
- **WHEN** an `update` deletes `a`
- **THEN** the histories are `[true, false]`, `[undefined]`, and `[['a'], []]`, respectively

#### Scenario: Presence reads leave own-key output unchanged

- **GIVEN** a store whose `Reflect.ownKeys` output has been captured after its existing metadata has been initialized
- **WHEN** code subscribes to several string and symbol presence checks
- **THEN** `Reflect.ownKeys` returns exactly the same keys and existing internal symbols, with no additional metadata key

#### Scenario: Existing virtual-symbol results are preserved

- **GIVEN** the store's existing internal-symbol presence behavior
- **WHEN** code checks those symbols before and after ordinary presence subscriptions and mutations
- **THEN** their results remain unchanged, including symbols not previously treated as always present

### Requirement: Array presence follows actual indices and length mutations

Array presence checks SHALL distinguish holes from present indices and observe removal by explicit deletion or length shrink. Length growth over holes and mutations that leave a tested key's prototype-chain presence unchanged SHALL NOT notify that presence dependency. Numeric-looking non-index property names and symbols SHALL retain normal property-presence semantics.

#### Scenario: Deleting an undefined-valued index

- **GIVEN** an effect checking index `0` on `[undefined]`
- **WHEN** an `update` deletes that index
- **THEN** the effect observes `[true, false]` even though the array length is unchanged

#### Scenario: Filling and deleting a hole

- **GIVEN** an effect checking a hole within a sparse array's existing length
- **WHEN** separate updates fill it with `1` and delete it
- **THEN** the history is `[false, true, false]`

#### Scenario: Truncation affects only changed index-presence booleans

- **GIVEN** presence effects for defined and undefined-valued indices being removed, a retained index, and an already absent hole
- **WHEN** an `update` shrinks array length past the removed indices
- **THEN** only effects whose boolean becomes `false` re-run; retained and already absent checks do not

#### Scenario: Inherited index presence survives truncation

- **GIVEN** an array with an own observed index shadowing a stable inherited index
- **WHEN** length shrink removes the own index
- **THEN** the presence result remains `true` and its presence-only effect does not re-run

#### Scenario: Growing length does not fill holes

- **GIVEN** a presence reader for an absent index
- **WHEN** an `update` grows length beyond that index without assigning it
- **THEN** the result stays `false` and the reader does not re-run

#### Scenario: Canonical index boundaries and ordinary properties

- **GIVEN** checks for canonical index strings `"0"` and `"4294967294"`, non-index keys `"-0"`, `"01"`, `"1.0"`, `"1e0"`, `"-1"`, `"0.5"`, `"4294967295"`, and a symbol key on a sparse array
- **WHEN** length shrink removes populated canonical indices but leaves the other properties intact
- **THEN** only the affected canonical-index presence observers report removal; ordinary properties and symbols remain present without spurious notifications

### Requirement: Presence observes batch writes immediately while effects remain deferred

Derived presence reads inside `update` SHALL reflect all preceding supported mutations. Direct presence effects SHALL remain deferred until the outermost batch ends and run at most once for changes to their dependencies. A transient presence change can schedule one final same-boolean run; no transaction-net suppression is promised. Existing recipe-error behavior SHALL remain unchanged.

#### Scenario: A derived reads deletion and re-addition inside a recipe

- **GIVEN** a primed derived checking a present key and a direct presence effect
- **WHEN** one recipe deletes the key, reads the derived, re-adds the key, and reads it again
- **THEN** those reads return `false` then `true`, the effect has not run during the recipe, and it runs once afterwards observing the final `true`

#### Scenario: A derived reads array truncation inside a recipe

- **GIVEN** a primed derived checking an array index removed by truncation
- **WHEN** a recipe shrinks length and reads the derived before returning
- **THEN** the derived returns `false` immediately while effects remain deferred

#### Scenario: Several writes expose only completed state to effects

- **GIVEN** an effect observing presence of several keys
- **WHEN** one update performs several additions, removals, and value-only writes
- **THEN** the effect re-runs once after the update and records only the final presence snapshot

#### Scenario: An outer batch and a thrown recipe retain normal semantics

- **GIVEN** a presence effect and an update inside an outer batch
- **WHEN** the recipe changes presence and throws
- **THEN** the recipe error reaches its caller, completed writes remain visible, and the effect runs once when the outermost batch ends
