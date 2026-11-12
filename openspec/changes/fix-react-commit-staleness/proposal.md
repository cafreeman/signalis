# Proposal

## Why

React components can show stale values. A `reactor` component or a `useDerived` value links its render-time reads only after React commits, so that an abandoned render leaves no subscriptions behind. When a signal it read is written between that render and the commit (by an ancestor's layout effect, for example), nothing notices. The commit-time check catches a derived only while it remains invalidated; it misses signals and derived results recomputed by another reader before subscription. Three tests in `packages/react/tests/known-issues.spec.tsx` demonstrate this:

- A `reactor` component that starts reading a signal on a re-render misses a write to it made before that render commits (it shows `0`, the signal is `1`).
- `useDerived` misses a write made by an ancestor's layout effect on mount (it shows `2`, expected `10`).
- `useDerived` misses the same kind of write on a re-render (it shows `0`, expected `2`).

`reactor` works around the mount case for signals it reads directly by rendering every component a second time on mount, whether or not anything changed. That adds a render to every mount, and a fourth known-issue test demonstrates it (2 renders where 1 is enough). The workaround doesn't help `useDerived`: the second render re-reads the derived's stale cached value.

Review identified two further cases the fix must cover: a newly read derived that changes and becomes current again before subscription, and a cached `useDerived` result reused across a render-phase state replay after its source changed. Current status and the latest render's start time do not identify what the component actually observed.

## What Changes

- Signals and derived results carry versions, and deferred reads retain the versions they observed. Commit-time validation detects changed results even when a derived has already become current again; invalidated deriveds whose result is unchanged still suppress unnecessary component renders.
- Pending observations belong to the computation that produced the cached result, not the latest render invocation. Reusing a cached `useDerived` result across a render replay preserves those observations until recomputation or commit.
- `reactor` stops forcing a second render on mount. It still re-renders on mount when something it read changed before the commit, and still renders again after a Strict Mode remount, which recreates its subscription from scratch.
- A write a component makes during its own render, to a signal it read in that render, keeps today's behavior: a write that settles re-renders the component to show the settled value, and a write that never settles fails with React's re-render limit error instead of hanging. `packages/react/tests/reactor.spec.tsx` pins this.
- The four known-issue tests move into the regular React specs as plain tests. New regressions cover the two review cases, unchanged derived results, error-result transitions, and lazy deriveds mounting without an extra render.

No public API changes. Fewer renders on mount is observable, but only as a reduction in renders that changed nothing.

## Capabilities

### New Capabilities

- `react-integration`: how `reactor` components and `useDerived` values stay consistent with the signals and derived values they read across React's render and commit phases.

### Modified Capabilities

None.

## Impact

- `packages/core/src/signal.ts` and `derived.ts` (result versions and read observations), `state.ts` and `types.ts` (deferred observation bookkeeping), `utils.ts` (`hasInvalidatedSource`), and `derived.ts` and `reaction.ts` (pending collection and commit).
- `packages/react/src/reactor.ts` (mount effect).
- Tests: `packages/react/tests/known-issues.spec.tsx` (emptied), `reactor.spec.tsx`, `useDerived.spec.tsx`.
- A `patch` changeset for `@signalis/react` and `@signalis/core`.
- Benchmarks: one version field per signal and derived, increments on accepted writes or changed derived results, and version snapshots only for deferred computations. Re-run the core benchmark and measure React mounts/replays separately to cover deferred-read allocation costs.
