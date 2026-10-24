# Proposal

## Why

React components can show stale values. A `reactor` component or a `useDerived` value links its render-time reads only after React commits, so that an abandoned render leaves no subscriptions behind. When a signal it read is written between that render and the commit (by an ancestor's layout effect, for example), nothing notices. The commit-time check catches a derived that changed in that window, but it can't see a signal that did, because signals keep no record of when they were written. Three tests in `packages/react/tests/known-issues.spec.tsx` demonstrate this:

- A `reactor` component that starts reading a signal on a re-render misses a write to it made before that render commits (it shows `0`, the signal is `1`).
- `useDerived` misses a write made by an ancestor's layout effect on mount (it shows `2`, expected `10`).
- `useDerived` misses the same kind of write on a re-render (it shows `0`, expected `2`).

`reactor` works around the mount case for signals it reads directly by rendering every component a second time on mount, whether or not anything changed. That doubles the cost of mounting, and a fourth known-issue test demonstrates it (2 renders where 1 is enough). The workaround doesn't help `useDerived`: the second render re-reads the derived's stale cached value.

## What Changes

- Signals record when they were last written, so the commit-time check can tell whether a signal a computation read during render was written before the commit linked it. A computation that finds such a source runs again (a `reactor` component re-renders; a `useDerived` value recomputes and notifies its readers).
- `reactor` stops forcing a second render on mount. It still re-renders on mount when something it read changed before the commit, and still renders again after a Strict Mode remount, which recreates its subscription from scratch.
- A write a component makes during its own render, to a signal it read in that render, keeps today's behavior: a write that settles re-renders the component to show the settled value, and a write that never settles fails with React's re-render limit error instead of hanging. `packages/react/tests/reactor.spec.tsx` pins this.
- The four known-issue tests move into the regular React specs as plain tests.

No public API changes. Fewer renders on mount is observable, but only as a reduction in renders that changed nothing.

## Capabilities

### New Capabilities

- `react-integration`: how `reactor` components and `useDerived` values stay consistent with the signals and derived values they read across React's render and commit phases.

### Modified Capabilities

None.

## Impact

- `packages/core/src/signal.ts`, `state.ts`, `utils.ts` (`hasInvalidatedSource`), `derived.ts` and `reaction.ts` (`_commitSourceCollection`).
- `packages/react/src/reactor.ts` (mount effect).
- Tests: `packages/react/tests/known-issues.spec.tsx` (emptied), `reactor.spec.tsx`, `useDerived.spec.tsx`.
- A `patch` changeset for `@signalis/react` and `@signalis/core`.
- Benchmarks: one more field per signal and one counter increment per write that changes a value. Re-run `pnpm bench` against the current baseline.
