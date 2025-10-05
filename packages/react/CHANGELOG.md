# @signalis/react

## 0.2.6

### Patch Changes

- 1687f97: Fix useSignal type signature to prevent incorrect errors with null values

  Fixed TypeScript overload ordering and added function type exclusion to prevent false positive type errors. The type signature now correctly handles all use cases:
  - Fixed `useSignal(null)` incorrectly matching function initializer overload
  - Added `Exclude<T, Function>` to value overload to ensure functions are treated as initializers
  - Reordered overloads from most specific to least specific for proper type inference
  - Updated documentation to reflect corrected signatures

## 0.2.2

### Patch Changes

- e29788a: Fix useSignal type signature to properly handle null values
  - Remove T extends {} constraint from implementation signature that was preventing useSignal(null) from working
  - Fix arguments object usage in arrow function for ES5 compatibility
  - Update documentation to reflect correct type signatures
  - Add comprehensive type tests for all useSignal modes

  Fixes issue where useSignal(null) was incorrectly rejected by TypeScript despite being a valid use case.

## 0.2.1

### Patch Changes

- Fix useSignal type signature to properly handle null values
  - Remove T extends {} constraint from implementation signature that was preventing useSignal(null) from working
  - Fix arguments object usage in arrow function for ES5 compatibility
  - Update documentation to reflect correct type signatures
  - Add comprehensive type tests for all useSignal modes

  Fixes issue where useSignal(null) was incorrectly rejected by TypeScript despite being a valid use case.

## 0.2.0

### Minor Changes

- 5e1991e: Add optional deps parameter to useDerived to support mixed dependencies

  useDerived now accepts an optional `deps` parameter to handle derived values that depend on both signals and non-signal values (props, useState, useContext). When deps change, the derived recreates with fresh closures while signal reactivity continues to work automatically.
  - Added `deps?: DependencyList` parameter to `useDerived`
  - Updated documentation with examples of mixed dependencies
  - Added comprehensive tests for mixed dependency scenarios
  - Fixed stale closure issue when derived values reference props or state alongside signals

- 5e1991e: Add optional deps parameter to useSignalEffect to support mixed dependencies

  useSignalEffect now accepts an optional `deps` parameter to handle effects that depend on both signals and non-signal values (props, useState, useContext). When deps change, the effect recreates with fresh closures while signal reactivity continues to work automatically.
  - Added `deps?: DependencyList` parameter to `useSignalEffect`
  - Updated documentation with examples of mixed dependencies
  - Added comprehensive tests for mixed dependency scenarios
  - Fixed stale closure issue when effects reference props or state alongside signals

- 5e1991e: Add lazy initialization support to useSignal

  useSignal now supports lazy initialization via function initializers, matching React's useState pattern. This allows expensive initial value computations to run only once on mount, rather than on every render.
  - Added function overload: `useSignal<T>(initializer: () => T): Signal<T>`
  - Functions are treated as initializers (call once to get initial value)
  - Full backward compatibility with direct value initialization
  - Added comprehensive tests verifying lazy init behavior and type inference
  - Updated documentation with examples and best practices

## 0.1.1

### Patch Changes

- 6965ccb: fix bug in reactor and bump CI
- Updated dependencies [6965ccb]
  - @signalis/core@0.1.1

## 0.1.0

### Minor Changes

- move everything to 0.1.0

### Patch Changes

- Updated dependencies
  - @signalis/core@0.1.0

## 0.0.9

### Patch Changes

- Updated dependencies [f947bab]
  - @signalis/core@0.0.12

## 0.0.8

### Patch Changes

- 9d54f25: add `createStore` and update package keywords
- Updated dependencies [9d54f25]
- Updated dependencies [6d4bb23]
  - @signalis/core@0.0.11

## 0.0.7

### Patch Changes

- Updated dependencies [215ba20]
  - @signalis/core@0.0.10

## 0.0.6

### Patch Changes

- d01828f: Add README for each individual package
- Updated dependencies [d01828f]
  - @signalis/core@0.0.9

## 0.0.5

### Patch Changes

- 472ebcf: Fix `useSignal` implementation so empty strings pass through

## 0.0.4

### Patch Changes

- 0d1a450: Re-export all of core from `@signalis/react`
- Updated dependencies [0d1a450]
  - @signalis/core@0.0.8
