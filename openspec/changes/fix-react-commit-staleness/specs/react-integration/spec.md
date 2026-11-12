# Spec Delta

## Purpose

Defines how React components wrapped with `reactor`, and derived values created with `useDerived`, stay consistent with the signals and derived values they read across React's render and commit phases.

## ADDED Requirements

### Requirement: Writes between render and commit are not lost

After a `reactor` component commits, it SHALL show the current value of every signal and derived value it read during the committed render, including values written after that render and before its commit, on mount and on re-renders alike.

#### Scenario: Ancestor layout effect writes a signal on mount

- **WHEN** a `reactor` component reads a signal during its first render, and an ancestor's layout effect writes that signal before the component commits
- **THEN** the component re-renders and shows the written value

#### Scenario: A signal first read on a re-render is written before that render commits

- **WHEN** a `reactor` component starts reading a signal on a re-render, and a layout effect writes that signal before the re-render commits
- **THEN** the component re-renders and shows the written value

#### Scenario: A derived first read on a re-render changes before that render commits

- **WHEN** a `reactor` component starts reading a derived value on a re-render, and a layout effect writes a signal that derived value depends on before the re-render commits
- **THEN** the component re-renders and shows the derived value's new result

#### Scenario: A changed derived is recomputed by another reader before subscription

- **WHEN** a component first renders a derived result of `0`, a layout effect changes its source, and another read recomputes the derived to `2` before the component subscribes
- **THEN** the component re-renders and shows `2`, even though that other read already made the derived current

#### Scenario: A derived is invalidated but its result is unchanged

- **WHEN** a component renders a derived value, a layout effect changes an upstream signal before subscription, and the derived recomputes to the same result
- **THEN** the component shows that result without an additional render solely for the upstream write

#### Scenario: A caught derived error becomes a value before subscription

- **WHEN** a component catches a derived's error and renders a fallback, then a layout effect changes its source and another reader successfully recomputes it before subscription
- **THEN** the component re-renders and shows the successful value instead of retaining the fallback

### Requirement: useDerived values reflect writes between render and commit

A derived value created with `useDerived` SHALL reflect every write made to its sources before the component that created it commits, and components that read it SHALL re-render to show its new result.

#### Scenario: Ancestor layout effect writes a source on mount

- **WHEN** a `reactor` component reads a `useDerived` value during its first render, and an ancestor's layout effect writes a signal the derived value depends on before the component commits
- **THEN** the component re-renders and shows the result computed from the written value

#### Scenario: A source first read on a re-render is written before that render commits

- **WHEN** a `useDerived` value starts depending on a signal during a re-render, and a layout effect writes that signal before the re-render commits
- **THEN** the component re-renders and shows the result computed from the written value

#### Scenario: A render-phase state replay reuses a cached derived result

- **WHEN** a component computes a `useDerived` result of `2` from a signal holding `1`, writes `5` to that signal, and adjusts its React state so React replays the render before subscription
- **THEN** after commit the component shows `10`, even if the replay initially reused the cached `2`

### Requirement: A reactor component renders once on mount when nothing changes

A `reactor` component SHALL render exactly once on mount when nothing it read changes between that render and its commit. Strict Mode's development-only remount, which disposes and recreates the component's subscription, MAY add a render.

#### Scenario: Mount with no intervening writes

- **WHEN** a `reactor` component mounts outside Strict Mode and nothing writes a signal it read before it commits
- **THEN** the component renders exactly once

#### Scenario: First read computes a lazy derived

- **WHEN** a component mounts outside Strict Mode, its render first computes a lazy `useDerived` value, and no source changes after being read
- **THEN** the component shows the computed result and renders exactly once

#### Scenario: Strict Mode remount

- **WHEN** a `reactor` component mounts inside Strict Mode
- **THEN** after the remount the component is subscribed to what it read, and a later write to one of those signals re-renders it

### Requirement: Writes a component makes during its own render

When a `reactor` component writes, during its own render, a new value to a signal it read in that render, it SHALL re-render until the value settles and then show the settled value. If the value never settles, rendering SHALL fail with React's re-render limit error rather than loop forever. A write of the value the signal already holds SHALL cause no re-render.

#### Scenario: A write that settles, on mount

- **WHEN** a `reactor` component reads a signal holding `0` and, during the same render, writes `1` to it only if it is less than `1`
- **THEN** the component shows `1` after mounting

#### Scenario: A write that settles, on a re-render

- **WHEN** an outside write makes a mounted `reactor` component re-render, and during that render the component writes a new value to a signal it read only if the signal hasn't reached that value yet
- **THEN** the component shows the settled value

#### Scenario: A write of the value the signal already holds

- **WHEN** a `reactor` component writes to a signal it read, during the same render, the value that signal already holds
- **THEN** the component renders exactly once on mount

#### Scenario: A write that never settles

- **WHEN** a `reactor` component writes a value different from the one it read to the same signal on every render
- **THEN** rendering throws React's re-render limit error

### Requirement: Abandoned renders leave no subscriptions

A render that React abandons before committing (because it suspended, threw, or was interrupted) SHALL leave no subscription to anything it read.

#### Scenario: A sibling suspends

- **WHEN** a `reactor` component renders and reads a signal, and a sibling inside the same Suspense boundary suspends before the commit
- **THEN** the signal has no observers
