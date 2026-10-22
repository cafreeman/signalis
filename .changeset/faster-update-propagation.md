---
'@signalis/core': patch
---

Speed up update propagation and fix stale reads after deferred source collection

- A derived that is already stale no longer re-notifies its observers when it becomes dirty, which removes redundant work on deep and wide graphs
- Writes inside `batch` no longer allocate a closure and map entry per write
- Scheduling a reaction no longer scans the queue of pending reactions
- A derived or reaction whose deferred source collection (as used by `useDerived` and `reactor`) links it to a source that was invalidated after it was read now revalidates, instead of serving the value computed before that change
- Reading a derived inside `batch` now picks up a change made earlier in the batch to a derived it depends on, instead of returning its previous value
- Marking the graph stale after a write now walks it with a loop instead of recursion, so a write to a signal with a very deep chain of deriveds below it no longer throws a `RangeError`. Effects still run in the same order
- Reading a derived that is already up to date is faster
