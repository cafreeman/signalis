# batch Specification

## Purpose

Defines how `batch` groups signal writes: values read inside a batch always reflect the writes made so far, and effects observe the batch only once, after it ends.

## Requirements

### Requirement: Reads inside a batch reflect earlier writes at any depth

A derived value read inside a batch SHALL reflect every write made earlier in that batch to any signal it depends on, directly or through other derived values, regardless of the order in which derived values are read.

#### Scenario: Reading a derived two levels below the written signal

- **GIVEN** a signal `s`, a derived `a` that reads `s`, and a derived `b` that reads `a`, all up to date
- **WHEN** `s` is written inside a batch and `b` is read before `a` is read
- **THEN** `b` reflects the new value of `s`

#### Scenario: Reading a diamond join

- **GIVEN** a signal `s`, deriveds `left` and `right` that each read `s`, and a derived `join` that reads both, all up to date
- **WHEN** `s` is written inside a batch and `join` is read
- **THEN** `join` reflects the new value of `s` through both branches

#### Scenario: Read order does not change the result

- **GIVEN** a chain of derived values below a signal, all up to date
- **WHEN** the signal is written inside a batch and the derived values are read top-down in one batch and bottom-up in another
- **THEN** every derived value has the same value in both batches

#### Scenario: A second write after a read

- **GIVEN** a derived `b` two levels below a signal `s`, up to date
- **WHEN** `s` is written, `b` is read, and `s` is written again inside the same batch, and `b` is read again
- **THEN** the second read of `b` reflects the second write

### Requirement: Effects do not run until the outermost batch ends

An effect SHALL NOT run while a batch is open, whatever is read or written inside the batch. Reading a derived value or writing another signal inside the batch MUST NOT cause an effect to run before the outermost batch ends.

#### Scenario: A read followed by more writes

- **GIVEN** an effect that reads signals `s`, `u` and `v`, and a derived `a` that reads `s`
- **WHEN** a batch writes `s`, reads `a`, then writes `u` and `v`
- **THEN** the effect does not run until the batch ends, and it then runs once and sees the final values of `s`, `u` and `v`

#### Scenario: No interleaving of reads and writes runs an effect

- **GIVEN** an effect that reads several signals and derived values at different depths
- **WHEN** a batch performs any mix of writes to those signals and reads of those derived values, in any order
- **THEN** the effect has not run at any point before the batch ends

#### Scenario: Nested batches

- **GIVEN** an effect that reads a signal
- **WHEN** the signal is written inside an inner batch nested in an outer batch
- **THEN** the effect does not run when the inner batch ends, and runs once when the outer batch ends

### Requirement: Disposing a derived value does not run effects needlessly

Disposing a derived value SHALL NOT run an effect that reads it unless the derived value's result has changed, and SHALL NOT leave the effect to run at a later, unrelated write. An effect that reads a disposed derived value MUST keep tracking it.

#### Scenario: An effect reads a disposed derived value

- **GIVEN** an effect that reads a derived value `d`
- **WHEN** `d` is disposed
- **THEN** the effect does not run, and it still runs when a signal `d` reads changes `d`'s result

#### Scenario: An unrelated write after disposal

- **GIVEN** an effect that reads a derived value that was disposed
- **WHEN** an unrelated signal is written afterwards
- **THEN** the effect does not run

#### Scenario: An upstream change that leaves the result the same

- **GIVEN** an effect that reads a derived value `d` that was disposed
- **WHEN** a signal `d` reads changes in a way that leaves `d`'s result the same
- **THEN** the effect does not run

#### Scenario: The effect is disposed right after the derived value

- **GIVEN** an effect that reads a derived value `d`, such as a component's effect and its `useDerived` value when it unmounts
- **WHEN** `d` is disposed and then the effect is disposed
- **THEN** the effect never runs, so a side effect such as an API call does not fire

### Requirement: An effect runs once per batch

An effect whose sources changed during a batch SHALL run exactly once after the outermost batch ends, however many of its sources were written or how many times each was written.

#### Scenario: Several writes to the same and different signals

- **GIVEN** an effect that reads signals `x` and `y`
- **WHEN** a batch writes `x` twice and `y` once
- **THEN** the effect runs once after the batch, with the final values

#### Scenario: A read inside the batch does not add runs

- **GIVEN** an effect that reads a derived `d`
- **WHEN** a batch writes a signal that `d` depends on and then reads `d`
- **THEN** the effect still runs only once, after the batch ends
