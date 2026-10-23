# Spec Delta

## ADDED Requirements

### Requirement: A batch callback's error is not replaced by an effect's error

When the callback passed to `batch` throws, `batch` SHALL throw that error to its caller, after the effects of the writes made before the throw have run once. An error thrown by an effect during that run MUST NOT replace it.

#### Scenario: The callback and an effect both throw

- **GIVEN** an effect that throws when it re-runs
- **WHEN** a `batch` callback writes the effect's source and then throws
- **THEN** `batch` throws the callback's error, the effect has run once, and the effect's error went to the error handler

#### Scenario: The callback throws and nothing else does

- **GIVEN** an effect that reads a signal
- **WHEN** a `batch` callback writes the signal and then throws
- **THEN** `batch` throws the callback's error and the effect runs once with the written value

### Requirement: Ending a batch does not throw because of an effect

Ending the outermost `batch` SHALL NOT throw an error raised by an effect. Every effect scheduled by the batch MUST still run, whether or not an earlier one threw.

#### Scenario: An effect throws when the batch ends

- **GIVEN** two effects that read the same signal, one of which throws
- **WHEN** a `batch` writes the signal
- **THEN** `batch` returns normally and both effects ran once
