# Spec Delta

## Purpose

Defines where an error thrown by user code surfaces (to the code that asked for the work, or to a global error handler) and guarantees that a throw never leaves the reactive graph unable to track or notify.

## ADDED Requirements

### Requirement: An error reaches the code that asked for the work

An error SHALL be thrown to the caller when that caller asked for the work that threw: reading a derived value, creating an effect (its first run), the first check of `when`, disposing an effect whose cleanup throws, and calling `batch`. A plain `try/catch` around that call MUST catch it.

#### Scenario: Reading a derived value that throws

- **GIVEN** a derived value whose function throws
- **WHEN** the value is read inside a `try/catch`
- **THEN** the read throws the same error and the `catch` block runs

#### Scenario: The first run of an effect throws

- **WHEN** `createEffect` is called with a function that throws on its first run
- **THEN** `createEffect` throws that error to its caller, and the effect is disposed so it never runs again

#### Scenario: The first check of when throws

- **WHEN** `when` is called with a predicate or callback that throws during its first evaluation
- **THEN** `when` throws that error to its caller, and the reaction is disposed

#### Scenario: A cleanup function throws on dispose

- **GIVEN** an effect that returned a cleanup function that throws
- **WHEN** the effect's disposer is called
- **THEN** the disposer throws that error to its caller after the effect has already been unsubscribed, so it never runs again

### Requirement: Disposing twice does nothing

Calling an effect's disposer, or a reaction's `dispose()`, after it has already been disposed MUST do nothing: it MUST NOT run the cleanup function again or throw.

#### Scenario: A disposer is called twice

- **GIVEN** an effect that returned a cleanup function
- **WHEN** its disposer is called twice
- **THEN** the cleanup function has run once and the second call returns normally

### Requirement: An effect's error on a later run does not reach the writer

An effect that re-runs because a source changed has no caller, so its error MUST NOT be thrown from the write or batch that triggered it. A write or batch MUST throw only for errors in the write itself or the batch callback.

#### Scenario: A write triggers an effect that throws

- **GIVEN** an effect that throws when a signal exceeds a limit
- **WHEN** the signal is written past the limit inside a `try/catch`
- **THEN** the write does not throw, and the `catch` block does not run

#### Scenario: A batch ends and an effect throws

- **GIVEN** an effect that throws when it re-runs
- **WHEN** a `batch` that writes the effect's source ends
- **THEN** `batch` returns normally

#### Scenario: A different effect throws during an effect's own write

- **GIVEN** effect A writes a signal that effect B reads, and B throws
- **WHEN** A re-runs and writes that signal
- **THEN** A completes normally, stays active, and runs again on its next source change

#### Scenario: An effect throws because of a resource's write

- **GIVEN** a resource and an effect that throws when it sees the resource's fetched value
- **WHEN** the fetch resolves and the resource writes the value
- **THEN** the effect's error goes to the error handler, and the resource's `error` stays unset

### Requirement: Errors from effects go to a configurable handler

An error from an effect that has no caller SHALL be passed to the handler installed with `setErrorHandler`. With no handler installed, the error MUST be rethrown asynchronously on a later task so it is visible as an uncaught error and fails a test run. `setErrorHandler` SHALL return a function that restores the previous handler.

#### Scenario: A handler receives the error

- **GIVEN** a handler installed with `setErrorHandler` and an effect that throws on a later run
- **WHEN** a source of the effect changes
- **THEN** the handler is called once with the thrown error and no uncaught error is raised

#### Scenario: No handler is installed

- **GIVEN** no handler and an effect that throws on a later run
- **WHEN** a source of the effect changes
- **THEN** the write returns normally and the error is thrown asynchronously as an uncaught error

#### Scenario: Restoring the previous handler

- **GIVEN** handler A installed, then handler B installed
- **WHEN** the function returned for B is called
- **THEN** later effect errors go to handler A

#### Scenario: The handler itself throws

- **GIVEN** a handler that throws
- **WHEN** an effect throws on a later run
- **THEN** the write returns normally, the remaining queued effects still run, and the handler's error is thrown asynchronously

### Requirement: An effect stays active after it throws

An effect that throws MUST remain subscribed to every source it read before the throw and MUST run again when any of them changes. A throwing effect MUST NOT prevent other queued effects from running.

#### Scenario: An effect throws once and a source changes again

- **GIVEN** an effect that throws on one run and succeeds on others
- **WHEN** a source it read before throwing changes after the throwing run
- **THEN** the effect runs again

#### Scenario: Siblings run in the same flush

- **GIVEN** two effects that read the same signal, one of which throws
- **WHEN** the signal is written
- **THEN** the other effect runs in the same flush, inside or outside a batch

#### Scenario: An effect over a derived value that throws once

- **GIVEN** an effect that reads a derived value which throws for one input and succeeds for others
- **WHEN** the input changes to the throwing value and then to a succeeding value
- **THEN** the effect runs again with the succeeding value

### Requirement: A derived value that throws keeps its error until a source changes

A derived value whose function throws SHALL throw the same error on every read until a source it read before the throw changes, and it MUST then recompute. It MUST notify its dependents when it starts or stops throwing. If the thrown value is a promise, the derived value SHALL recompute once the promise settles.

#### Scenario: Repeated reads

- **GIVEN** a derived value that threw
- **WHEN** it is read again with no source change
- **THEN** it throws the same error without running its function again

#### Scenario: Recovery after a source changes

- **GIVEN** a derived value that threw
- **WHEN** a source it read changes so the function succeeds, and the value is read
- **THEN** the read returns the new value

#### Scenario: A dependent effect sees the recovery

- **GIVEN** an effect that read a derived value while it was throwing
- **WHEN** a source changes so the derived value succeeds
- **THEN** the effect runs and reads the new value

#### Scenario: A thrown promise

- **GIVEN** a derived value that throws a promise while data is loading
- **WHEN** the promise resolves and no source has changed
- **THEN** the derived value recomputes and its dependents re-run

### Requirement: A throw does not corrupt dependency tracking

After user code throws inside a derived value or an effect, later reads MUST be tracked by the computation that performs them. A computation that catches a derived value's error MUST keep every dependency it read before and after the catch.

#### Scenario: Catching a derived value's error inside an effect

- **GIVEN** an effect that reads a signal, then reads a derived value that throws inside a `try/catch`, then reads another signal
- **WHEN** a signal that only the derived value reads changes, or the other signal changes
- **THEN** the effect re-runs for each change

#### Scenario: A derived value throws on the effect's first run

- **GIVEN** an effect that reads a signal, then reads a derived value inside a `try/catch` that throws on the effect's first run, then reads another signal
- **WHEN** the first signal changes
- **THEN** the effect re-runs

#### Scenario: Catching a derived value's error inside another derived value

- **GIVEN** a derived value that reads a signal, then reads a throwing derived value inside a `try/catch`, then reads another signal
- **WHEN** the first signal changes and the outer derived value is read
- **THEN** it recomputes

#### Scenario: A derived value that throws outside any computation

- **GIVEN** a derived value read at the top level that throws
- **WHEN** a signal is read afterwards at the top level
- **THEN** that read is not tracked by the derived value

### Requirement: A final when runs its callback at most once

A `when` created with `final: true` SHALL be disposed before its callback runs, so the callback runs at most once even if it throws.

#### Scenario: The callback of a final when throws

- **GIVEN** a `when` with `final: true` whose callback throws
- **WHEN** its condition becomes true
- **THEN** the callback is called once, the reaction is already disposed, and the condition changing again does not call the callback

### Requirement: An abandoned render leaves no subscriptions when a derived value throws

In `@signalis/react`, a render that reads a derived value which throws, and is then abandoned (for example by Suspense), MUST NOT leave the derived value or the component subscribed to any source.

#### Scenario: A derived value throws during a render that never commits

- **GIVEN** a component that reads a derived value whose function reads a signal and then throws, rendered inside Suspense or an error boundary that never commits it
- **WHEN** the render is abandoned
- **THEN** the signal has no observers
