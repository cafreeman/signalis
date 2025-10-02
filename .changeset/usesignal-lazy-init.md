---
'@signalis/react': minor
---

Add lazy initialization support to useSignal

useSignal now supports lazy initialization via function initializers, matching React's useState pattern. This allows expensive initial value computations to run only once on mount, rather than on every render.

- Added function overload: `useSignal<T>(initializer: () => T): Signal<T>`
- Functions are treated as initializers (call once to get initial value)
- Full backward compatibility with direct value initialization
- Added comprehensive tests verifying lazy init behavior and type inference
- Updated documentation with examples and best practices
