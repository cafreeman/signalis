# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Signalis is a lightweight reactivity library with core primitives and React integration, distributed as a pnpm monorepo with two publishable packages:

- **@signalis/core**: Core reactivity primitives (signals, derived, effects, stores)
- **@signalis/react**: React integration hooks and components

## Development Commands

All commands should be run from the repository root:

### Core Development
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Watch tests in specific package
cd packages/core && pnpm dev
cd packages/react && pnpm dev

# Lint all packages
pnpm lint
pnpm lint:fix

# Clean build artifacts
pnpm clean
```

### Package-Specific Development
```bash
# Test individual packages
cd packages/core && pnpm test
cd packages/react && pnpm test

# Build individual packages
cd packages/core && pnpm build
cd packages/react && pnpm build
```

### Release Management
```bash
# Create release (automated via release-it)
pnpm release

# Test release process
pnpm release:dry
```

## Architecture Overview

### Core Reactivity System

The reactivity system is built around a push-pull model with lazy evaluation:

- **State Management**: Central coordination in `packages/core/src/state.ts` handles dependency tracking, dirty checking, and reaction scheduling
- **Observer Pattern**: All reactive primitives maintain `_observers` arrays for dependency notifications
- **Lazy Evaluation**: Derived values only recompute when accessed, not when dependencies change
- **Dependency Tracking**: Automatic via `markDependency()` during reads and `markUpdates()` during writes

### Key Primitives

1. **Signal** (`packages/core/src/signal.ts`): Writable reactive value
2. **Derived** (`packages/core/src/derived.ts`): Readonly computed value (lazy)
3. **Effect** (`packages/core/src/effect.ts`): Side-effect function (eager)
4. **Reaction** (`packages/core/src/reaction.ts`): Low-level reactive primitive that establishes tracking contexts
5. **Resource** (`packages/core/src/resource.ts`): Async reactive value
6. **Store** (`packages/core/src/store.ts`): Proxy-based fine-grained reactive objects

### React Integration Architecture

The React package uses `Reaction.trap()` to create reactive render contexts:

- **reactor HOC**: Wraps component renders in `Reaction.trap()` - only signal reads during render execution are tracked
- **useSignal/useDerived/useSignalEffect**: React hooks that integrate with React lifecycle
- **Critical distinction**: Signal reads in event handlers or callbacks are NOT tracked by reactor

## Code Conventions

### TypeScript & Module System
- **Always use `.js` extensions** in import paths, even for TypeScript files
- ESM modules with Node16 module resolution
- Extends `@tsconfig/strictest` for strict TypeScript

### Naming Conventions
- Factory functions: `createSignal()`, `createDerived()`, `createEffect()`
- Internal class properties: `_value`, `_observers` (underscore prefix)
- Type guards: `isSignal()`, `isDerived()`, `isReaction()`
- Symbol tags: PascalCase (e.g., `SignalTag`)

### Build Configuration
- **Vite**: Used for building both packages
- **TypeScript configs per package**:
  - `tsconfig.json`: Development and type checking
  - `tsconfig.build.json`: Building type declarations
- **Shared config**: `tsconfig.base.json`

### Testing
- **Vitest**: Test runner for both packages
- Tests located in `packages/*/tests/` directories
- React integration tests use `@testing-library/react`

## Monorepo Structure

- **Root**: Build orchestration, shared configs, shared dependencies
- **Packages**: Individual publishable packages with their own package.json
- **Workspace dependencies**: `@signalis/react` depends on `@signalis/core` via `workspace:*`
- **pnpm workspaces**: Defined in `pnpm-workspace.yaml`

## Reactivity Patterns

### Equality and Updates
- Signals support custom equality functions for change detection
- Use `false` as equality function for always-notify behavior
- Stores use Immer-like API via `update()` function for mutations

### Performance Considerations
- Derived values won't recompute unless dependencies changed AND value is accessed
- Use `batch()` to group multiple signal updates
- Effects run eagerly, derived values are lazy

### Resource Patterns
- Standalone: `createResource(() => fetchData())`
- With source: `createResource(sourceSignal, (source) => fetchData(source))`
- Fetcher only runs when source is truthy

## Important Implementation Notes

- **Observer management**: All reactive primitives maintain `_observers: Array<Derived<unknown> | Reaction> | null`
- **Reaction.trap()**: Core mechanism for establishing tracking contexts, used by effects and React integration
- **Internal vs Public APIs**: Classes prefixed with `_` are internal, public interfaces omit private members
- **Disposal pattern**: Functions requiring cleanup return disposal functions