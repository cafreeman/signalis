# Spec Delta

## Purpose

Defines how writable signals select and retain equality policies for explicit initial values, including null and undefined, and distinguishes those signals from the no-argument notifier.

## ADDED Requirements

### Requirement: Explicit initial values honor the selected equality policy

A signal created with an explicit initial value SHALL retain its selected equality policy across all later writes, including when the initial value is null or undefined. Omitting the comparator SHALL use strict equality (`===`). Passing `false` SHALL accept and notify on every write, including equal values.

#### Scenario: Explicit nullish defaults remain ordinary signals

- **GIVEN** a signal explicitly initialized with `X`, separately for null and undefined, without a comparator
- **WHEN** an effect reads it and separate writes supply `X`, `X`, `2`, and `2`
- **THEN** the effect's complete value history is `[X, 2]`, and the final value is `2`

#### Scenario: False honors every write for a nullish initial value

- **GIVEN** a signal explicitly initialized with null or undefined as `X` and comparator `false`
- **WHEN** an effect reads it and separate writes supply `X`, `X`, `2`, and `2`
- **THEN** the effect's complete value history is `[X, X, X, 2, 2]`, preserving always-notify behavior after the transition to `2`

### Requirement: Custom comparisons receive retained values and control acceptance

For each write, a custom comparator SHALL receive the currently retained value and proposed new value in that order. Returning `true` SHALL retain the old value without notifying; returning `false` SHALL retain the new value and notify. Creation and reads SHALL NOT call the comparator. These rules SHALL apply equally to explicit nullish and non-nullish initial values.

#### Scenario: A custom comparator accepts every write

- **GIVEN** a signal explicitly initialized with null or undefined as `X`, and a comparator always returning `false`
- **WHEN** separate writes supply `X`, `X`, `2`, and `2`
- **THEN** comparator arguments are `(X,X)`, `(X,X)`, `(X,2)`, `(2,2)` in order, and a direct effect records `[X, X, X, 2, 2]`

#### Scenario: Suppression retains the initial nullish value

- **GIVEN** a signal explicitly initialized with null or undefined as `X`, and a comparator always returning `true`
- **WHEN** separate writes supply `X`, `X`, `2`, and `2`
- **THEN** comparator arguments are `(X,X)`, `(X,X)`, `(X,2)`, `(X,2)` in order, the signal still holds `X`, and a direct effect records only `[X]`

#### Scenario: The comparator remains active after an accepted transition

- **GIVEN** a signal explicitly initialized with null or undefined as `X`, and a comparator that returns true for equal values or proposed `3`
- **WHEN** separate writes supply `2`, `3`, and `2`
- **THEN** comparator arguments are `(X,2)`, `(2,3)`, `(2,2)` in order, the retained value after each write is `2`, and a direct effect records `[X, 2]`

#### Scenario: Creation and reads do not compare

- **GIVEN** a signal created with an explicit nullish value and a custom comparator
- **WHEN** code reads it directly, creates an effect reading it, and reads it again without writes
- **THEN** the comparator has not been called and the retained value is unchanged

### Requirement: The no-argument signal remains a distinct notifier

Calling `createSignal()` with no arguments SHALL create a notifier initially holding null that accepts and notifies on every write. This behavior SHALL remain distinct from explicitly providing null or undefined without a comparator, which SHALL retain default strict equality.

#### Scenario: The notifier accepts repeated equal writes

- **GIVEN** a zero-argument signal and a direct effect recording its value
- **WHEN** separate writes supply null, null, undefined, and undefined
- **THEN** its complete history is `[null, null, null, undefined, undefined]`

#### Scenario: Explicit undefined is not the no-argument notifier

- **GIVEN** one signal created with `createSignal()` and another with `createSignal(undefined)`
- **WHEN** direct effects read them and each receives two separate undefined writes
- **THEN** the notifier records `[null, undefined, undefined]`, while the explicit-undefined signal records only `[undefined]`
