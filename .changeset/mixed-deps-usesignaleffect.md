---
'@signalis/react': minor
---

Add optional deps parameter to useSignalEffect to support mixed dependencies

useSignalEffect now accepts an optional `deps` parameter to handle effects that depend on both signals and non-signal values (props, useState, useContext). When deps change, the effect recreates with fresh closures while signal reactivity continues to work automatically.

- Added `deps?: DependencyList` parameter to `useSignalEffect`
- Updated documentation with examples of mixed dependencies
- Added comprehensive tests for mixed dependency scenarios
- Fixed stale closure issue when effects reference props or state alongside signals
