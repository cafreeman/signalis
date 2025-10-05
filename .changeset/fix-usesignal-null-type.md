---
'@signalis/react': patch
---

Fix useSignal type signature to prevent incorrect errors with null values

Fixed TypeScript overload ordering and added function type exclusion to prevent false positive type errors. The type signature now correctly handles all use cases:

- Fixed `useSignal(null)` incorrectly matching function initializer overload
- Added `Exclude<T, Function>` to value overload to ensure functions are treated as initializers
- Reordered overloads from most specific to least specific for proper type inference
- Updated documentation to reflect corrected signatures
