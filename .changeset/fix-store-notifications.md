---
'@signalis/core': minor
---

Fix store notification tracking and avoid re-running observers for unchanged observations.

- Every computation enumerating store keys now subscribes reliably and stays subscribed across re-runs.
- **BREAKING:** Writing a property's current value (by `===`) no longer notifies its observers. Previously every write notified, even for the same value or object/array reference. To migrate code that used these writes to force a re-run, write a genuinely new value or use a separate signal created with `createSignal(initialValue, false)` when every write must notify.
- **BREAKING:** Key-set readers now re-run only when an own property is added or deleted, or an array's length changes. Previously a value-only write also notified key-set readers. To migrate code relying on those notifications, read the property values through the store inside the computation, for example with `Object.entries(store)`, rather than reading raw or untracked values after enumerating keys.
