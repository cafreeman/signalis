---
'@signalis/react': minor
---

Add optional deps parameter to useDerived to support mixed dependencies

useDerived now accepts an optional `deps` parameter to handle derived values that depend on both signals and non-signal values (props, useState, useContext). When deps change, the derived recreates with fresh closures while signal reactivity continues to work automatically.

- Added `deps?: DependencyList` parameter to `useDerived`
- Updated documentation with examples of mixed dependencies
- Added comprehensive tests for mixed dependency scenarios
- Fixed stale closure issue when derived values reference props or state alongside signals
