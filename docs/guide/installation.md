# Installation

Signalis is available as two separate packages on npm:

- `@signalis/core` - Core reactivity primitives
- `@signalis/react` - React integration (includes core as a dependency)

### Using npm

```bash
# Install core only
npm install @signalis/core

# Or install React integration (includes core)
npm install @signalis/react
```

### Using pnpm

```bash
# Install core only
pnpm add @signalis/core

# Or install React integration (includes core)
pnpm add @signalis/react
```

### Using yarn

```bash
# Install core only
yarn add @signalis/core

# Or install React integration (includes core)
yarn add @signalis/react
```

## Choosing a Package

### Install `@signalis/core` if you:

- Want to use Signalis with vanilla JavaScript/TypeScript
- Are using a framework other than React
- Need only the core reactivity primitives

### Install `@signalis/react` if you:

- Are building a React application
- Want React-specific hooks (`useSignal`, `useDerived`, `useSignalEffect`)
- Want the `reactor` HOC for automatic component re-rendering

**Note:** `@signalis/react` includes and re-exports all of `@signalis/core`, so you don't need to install both.

## Version Compatibility

- **Node.js**: 18.13.0 or higher
- **TypeScript**: 5.0 or higher (if using TypeScript)
- **React**: 19.0 or higher (for `@signalis/react`)

## What's Next?

Now that you have Signalis installed, let's build something!

- [Quick Start Tutorial](/guide/quick-start) - Build your first reactive application
- [Core Concepts](/guide/core-concepts) - Understand how Signalis works
