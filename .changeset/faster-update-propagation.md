---
'@signalis/core': patch
---

Fix stale reads after deferred source collection

- A derived or reaction whose deferred source collection (as used by `useDerived` and `reactor`) links it to a source that was invalidated after it was read now revalidates, instead of serving the value computed before that change
