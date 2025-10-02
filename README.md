# Signalis

`signalis` is a lightweight library for reactivity influenced by [`@preact/signals`](https://preactjs.com/guide/v10/signals/), [`solidjs`](https://www.solidjs.com/), and [`reactively`](https://github.com/modderme123/reactively). It aims to expose a small set of highly composable, highly performant primitives for building reactive programs as simply as possible.

## Packages

- **[`@signalis/core`](./packages/core/README.md)** - Core reactivity primitives (signals, derived, effects, stores)
- **[`@signalis/react`](./packages/react/README.md)** - React integration hooks and components

## Development

This project uses a monorepo structure with pnpm workspaces and automated release management.

### Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build packages
pnpm build

# Run linting
pnpm lint
```

### Release Process

This project uses **[Release It](https://github.com/release-it/release-it)** for automated releases:

```bash
# Create a release (automated)
pnpm release

# Test release process without publishing
pnpm release:dry
```

The release process automatically:
1. Applies changesets and bumps versions
2. Builds all packages
3. Creates git tags
4. Publishes to npm
5. Pushes changes to GitHub

For detailed release guidelines, see [Release Process Documentation](./.cursor/rules/release-process.mdc).
