# Getting Started

Welcome to Signalis! This guide will help you get up and running with Signalis in just a few minutes.

## What is Signalis?

Signalis is a lightweight library for reactivity influenced by [`@preact/signals`](https://preactjs.com/guide/v10/signals/), [`SolidJS`](https://www.solidjs.com/), and [`reactively`](https://github.com/modderme123/reactively). It aims to expose a small set of highly composable, highly performant primitives for building reactive programs as simply as possible.

## Key Features

- **Lazy Evaluation**: Derived values only recompute when accessed, not when their dependencies change
- **Push-Pull Model**: Changes push notifications, reads pull updates for maximum efficiency
- **Automatic Dependency Tracking**: No manual subscription management needed
- **Zero Dependencies**: Lightweight and focused
- **React Integration**: First-class React support with hooks and HOC

## Core Primitives

Signalis provides five core reactive primitives:

1. **[Signals](/core/signals)** - Writable reactive values
2. **[Derived](/core/derived)** - Readonly reactive computed values
3. **[Effects](/core/effects)** - Reactive side-effect functions
4. **[Resources](/core/resources)** - Async reactive values
5. **[Stores](/core/stores)** - Proxy-based fine-grained reactive objects

## Next Steps

- [Install Signalis](/guide/installation)
- [Quick Start Tutorial](/guide/quick-start)
- [Learn Core Concepts](/guide/core-concepts)
