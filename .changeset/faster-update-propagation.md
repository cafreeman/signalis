---
'@signalis/core': patch
---

Speed up update propagation, fix stale reads after deferred source collection, and make batches consistent: reads inside a batch reflect every earlier write, and effects never run until the batch ends

- A derived that is already stale no longer re-notifies its observers when it becomes dirty, which removes redundant work on deep and wide graphs
- Writes inside `batch` no longer allocate a closure and map entry per write, and no longer buffer anything: a write marks its observers right away and the batch only holds back running effects
- Scheduling a reaction no longer scans the queue of pending reactions
- A derived or reaction whose deferred source collection (as used by `useDerived` and `reactor`) links it to a source that was invalidated after it was read now revalidates, instead of serving the value computed before that change
- Reading a derived inside `batch` now reflects every earlier write in the batch, at any depth and in any read order. Before, a derived more than one level below a written signal returned its previous value, depending on which derived values were read first
- Effects no longer run in the middle of a batch. Reading a derived and then writing more signals inside a batch could run an effect against a half-applied update; effects now run only after the outermost batch ends, once each
- Marking the graph stale after a write now walks it with a loop instead of recursion, so a write to a signal with a very deep chain of deriveds below it no longer throws a `RangeError`. Effects still run in the same order
- Reading a derived that is already up to date is faster
- Disposing a derived with `dispose()` no longer leaves the effects that read it to run unconditionally at the next write of any signal. They now revalidate and run only if the derived's value changed, so a component unmounting or changing a `useDerived` dependency no longer causes a spurious render
