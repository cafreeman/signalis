# Spec Delta

## Purpose

Defines when effects run and how many times, for writes inside and outside a batch, so that callers know which orderings and counts they can rely on.

## ADDED Requirements

### Requirement: Effect run order is not specified

When one write, or one batch, changes the sources of several effects, each of those effects SHALL run, but the order in which they run is not specified and MAY change between releases. Code that needs one effect's work to happen before another's SHALL express that through the values they read, not through effect order.

#### Scenario: Two effects observe the same signal

- **WHEN** two effects each read signal `s`, and `s` is written outside a batch
- **THEN** both effects run once, in an unspecified order

### Requirement: An effect runs once per change, however often it read a source

An effect SHALL run at most once per write outside a batch, or once per outermost batch, however many times its last run read each source that changed.

#### Scenario: Reading one signal several times

- **WHEN** an effect reads signal `s` three times in one run, and `s` is written once
- **THEN** the effect runs once, with the new value

#### Scenario: Reading one signal directly and through a derived value

- **WHEN** an effect reads signal `s` and a derived value that depends on `s`, and `s` is written once
- **THEN** the effect runs once
