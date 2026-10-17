---
'@signalis/core': patch
---

Speed up update propagation and fix stale reads after deferred source collection

- A derived that is already stale no longer re-notifies its observers when it becomes dirty, which removes redundant work on deep and wide graphs
- Writes inside `batch` no longer allocate a closure and map entry per write
- Scheduling a reaction no longer scans the queue of pending reactions
- A derived or reaction whose deferred source collection (as used by `useDerived` and `reactor`) links it to a source that was invalidated after it was read now revalidates, instead of serving the value computed before that change
