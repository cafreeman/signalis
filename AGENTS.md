# AGENTS.md

Canonical guidance for AI agents (and human contributors) working in this repository.

## Hard rules

- **Don't commit unless explicitly asked.** Leave the working tree for review.
- **Never run `pnpm release`, `pnpm publish`, or push tags/branches.** Releases publish to npm and are human-triggered only. `pnpm release:dry` is safe to preview (verified on release-it 21: hooks are displayed but not executed in dry-run).
- **Never hand-edit `packages/*/CHANGELOG.md`.** Changelogs are generated from changeset files at release time.
- **Every change that affects a published package needs a changeset** (see below).

## Repository layout

- `packages/core` → `@signalis/core`: the reactivity engine (signals, derived, effects, reactions, resources, stores).
- `packages/react` → `@signalis/react`: React bindings; **re-exports all of `@signalis/core`**, so core's public API surface is also react's.
- `docs/`: VitePress site (deployed via GitHub Pages).

Toolchain: pnpm (pinned via `packageManager` in the root package.json and `mise.toml`), Node (pinned via `mise.toml`, engines requires >= 22.12). Local secrets belong in `mise.local.toml` (gitignored), never in `mise.toml`.

## Everyday commands

Run from the repository root:

```bash
pnpm install        # install dependencies
pnpm lint           # oxlint (config: .oxlintrc.json at repo root)
pnpm lint:fix       # oxlint with auto-fix
pnpm test           # vitest, all packages
pnpm build          # vite build + type declarations, all packages
pnpm clean          # remove dist directories
pnpm docs:dev       # VitePress docs dev server
```

Before declaring any change finished, all of these must pass:

```bash
pnpm lint
pnpm test
pnpm build
pnpm -r exec tsc --noEmit
node_modules/.bin/prettier --check .
```

## Changesets (required for published changes)

Versioning and changelogs run on [Changesets](https://github.com/changesets/changesets); release-it is only the orchestrator (see `.release-it.json`).

**Create a changeset when a change will be released to users:**

- ✅ New features, bug fixes, breaking changes, public API/packaging changes
- ❌ Internal refactoring with no user-facing effect, test-only changes, docs/CI/root tooling

**Format:** hand-write a markdown file in `.changeset/` (agents can't use the interactive `pnpm changeset` prompt). Use a kebab-case descriptive filename:

```markdown
---
'@signalis/core': minor
---

Add `when` and `untrack` to the public API

- `when` runs a callback once a predicate becomes true
- `untrack` reads reactive values without subscribing the running computation
```

**Bump levels:**

- `patch`: bug fixes, performance work, no public API change
- `minor`: new exports, optional parameters, deprecations
- `major`: removing/renaming public APIs or breaking signatures

**Fixed release group:** `.changeset/config.json` pins `@signalis/core` and `@signalis/react` to release in lockstep at the same version. A changeset touching either package bumps both; that's expected and prevents version drift between them.

**Verify pending changesets:** `pnpm changeset status` (read-only; shows the planned bumps).

## Commit format

Conventional commits with a package scope:

```
type(scope): subject

- optional detail bullets
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
Scopes: `core`, `react`, `root` (config/tooling).
Example: `fix(core): flush pending updates when a batch callback throws`.

## How a release works (reference — humans trigger this)

`pnpm release` (release-it, configured in `.release-it.json`):

1. `before:init`: `pnpm changeset version` (consumes `.changeset/*.md`, bumps versions, writes CHANGELOGs), commits "chore: version packages", `pnpm install`, `pnpm build`
2. `after:release`: creates git tag `v{core version}` (core is the root of the dependency graph; the fixed group guarantees both packages share that version), pushes with tags, `pnpm -r publish --access public`

The root `package.json` version is **not** used for releases — only `packages/*/package.json` versions matter.

### Troubleshooting releases

- **`pnpm changeset version` ran but the release didn't complete** (e.g. a real release failed partway, or someone ran `changeset version` manually): the changeset files are consumed, but their content now lives in the CHANGELOGs and the versions are bumped. Either finish the release manually if the code is ready, or reset and re-create changesets for further changes.
- **Failed release left a git tag behind**: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`, then revert any bogus commits.
- **Version drift**: workspace packages are the source of truth; compare `packages/*/package.json` and `npm view @signalis/<name> version`.

## Code conventions

- TypeScript ESM; **always use `.js` extensions** in import paths; `Node16` module resolution; extends `@tsconfig/strictest`.
- Linting is **oxlint** (root `.oxlintrc.json`). A handful of rules are deliberately disabled there because they conflict with reactivity idioms (e.g. mutating `signal.value` is the API; tests intentionally read `.value` bare to force lazy evaluation) — don't re-enable them without understanding why.
- Public interfaces that hide private fields use the `Omit` pattern: `export interface Signal<T> extends Omit<_Signal<T>, '_isEqual'> {}`.
- Internal class members are `_`-prefixed (`_value`, `_observers`, `_sources`).
- One primary export per file; internal helpers go above the main export.
- Anything needing cleanup returns a disposal function (`createEffect` returns one; `Reaction`/`Derived` have `dispose()`).

## Testing conventions

- Vitest; tests live in `packages/*/tests/` as `*.spec.ts` / `*.spec.tsx`; benchmarks in `packages/core/tests/bench/`.
- Import from source with relative paths (`import { createSignal } from '../src/signal'`), not from the package barrel.
- React component tests use `@testing-library/react`.
- To assert reactive updates, use a spy effect and count calls:

```typescript
const spy = vi.fn(() => {
  signal.value; // read to subscribe
});
createEffect(spy);
signal.value = 'new value';
expect(spy).toHaveBeenCalledTimes(2); // initial + update
```

## Reactivity gotchas

- `Derived` is lazy: it only recomputes when read. Reading `.value` in a test is how you force evaluation.
- `reactor` tracks signal reads **during render only** — reads in event handlers, callbacks, or effects are not tracked.
- `Derived#dispose()` resets the derived to its initial state (unsubscribed and dirty), and a later read re-subscribes it from scratch. Unlinking alone would NOT be safe: dirty-marking flows through observer lists, and `reconcileSources` assumes a computation's unchanged leading sources are still subscribed — an unlinked derived would go permanently stale. See the tests in `packages/core/tests/derived.spec.ts`.
- `@signalis/react` must never bundle `@signalis/core` (its vite config marks it external). Core's reactive graph is module-level state; a bundled copy would create a second, independent graph.
- Multiple signal writes can be grouped with `batch()` so observers run once.
