---
layout: home

hero:
  name: Signalis
  text: A lightweight library for reactivity
  tagline: Composable, performant primitives for building reactive programs simply
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/cafreeman/signalis

features:
  - icon: ⚡
    title: Lazy Evaluation
    details: Signals push notifications, derived values pull updates. All parts of the system are kept in sync lazily—changing a signal doesn't trigger computations, it simply tells dependents they'll need to recompute eventually.

  - icon: 🎯
    title: Highly Composable
    details: Signals, derived values, effects, resources, and stores. A small set of primitives that work together seamlessly to handle any reactivity scenario.

  - icon: 🪶
    title: Lightweight & Performant
    details: Zero dependencies. Smart recomputation minimizes unnecessary work. Derived values are clever about when they actually need to recompute.

  - icon: ⚛️
    title: React Integration
    details: First-class React support with the reactor HOC and hooks that integrate tightly with React's rendering cycle while maintaining signal semantics.
---

## Quick Example

```typescript
import { createSignal, createDerived, createEffect } from '@signalis/core';

const count = createSignal(0);
const doubled = createDerived(() => count.value * 2);

createEffect(() => {
  console.log(`Count: ${count.value}, Doubled: ${doubled.value}`);
});
// Logs immediately: "Count: 0, Doubled: 0"

count.value = 5; // Logs: "Count: 5, Doubled: 10"
```

## Three Core Primitives

**Signals** are the foundation—a box around a value that tells other things when it has changed. Read and write via `.value`.

**Derived** values are readonly reactive computations. They're lazy and smart about recomputation, only updating when accessed and when their dependencies actually change.

**Effects** are reactive functions for side effects. They run eagerly (not lazy) and can return cleanup functions for disposal.

## Inspiration

Signalis is influenced by [`@preact/signals`](https://preactjs.com/guide/v10/signals/), [`SolidJS`](https://www.solidjs.com/), and [`reactively`](https://github.com/modderme123/reactively).

## Packages

- **[@signalis/core](https://www.npmjs.com/package/@signalis/core)** - Core reactivity primitives
- **[@signalis/react](https://www.npmjs.com/package/@signalis/react)** - React integration
