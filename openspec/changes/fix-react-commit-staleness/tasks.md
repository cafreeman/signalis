# Tasks

## 1. Baseline

- [ ] 1.1 Record a benchmark baseline with `pnpm bench --framework signalis` run twice, and keep the output paths in this file for comparison in 4.2

## 2. Core: detect signals written since collection began

- [ ] 2.1 Add the write counter to `State`, with `nextWriteEpoch` and `getWriteEpoch` helpers in `state.ts`. Stamp `_writtenAt` in the `_Signal` setter only when the value changes. Verify `pnpm --filter @signalis/core test` passes
- [ ] 2.2 Change `hasInvalidatedSource(node, startIndex, since)` to report none, a non-CLEAN derived, or a signal written after `since`. Replace `Signal#_isClean` with that comparison. Add unit tests in `packages/core/tests/` for each outcome, and verify they pass
- [ ] 2.3 Record the count in `_beginSourceCollection` on `Reaction` and `Derived`. In `_commitSourceCollection`, mark DIRTY for a written signal or STALE for a non-CLEAN derived. Drain reactions after a derived commits when no batch is open. Verify the three "writes between render and commit" tests in `packages/react/tests/known-issues.spec.tsx` now fail as `test.fails` (meaning the behavior is fixed)

## 3. React: drop the unconditional mount render

- [ ] 3.1 In `reactor.ts`, call `forceUpdate()` in the mount effect only when it creates a fresh reaction, and update the comment. Verify "a reactor component renders once on mount when nothing changes" now fails as `test.fails`, and that all of `reactor.spec.tsx` passes unchanged, including the "writes a signal it reads, during its own render" group
- [ ] 3.2 Add a Strict Mode test to `reactor.spec.tsx`: mount a `reactor` component in `<StrictMode>`, write a signal it read, and verify that it re-renders with the new value
- [ ] 3.3 Move the four known-issue tests into `reactor.spec.tsx` and `useDerived.spec.tsx` as plain `test`s and delete `packages/react/tests/known-issues.spec.tsx`. Verify `pnpm --filter @signalis/react test` passes
- [ ] 3.4 Update the deferred-collection comments in `state.ts` and `utils.ts` and the "Reactivity gotchas" in `AGENTS.md` to say signals are covered too. Verify by reading that no comment still says `Signal#_isClean` is always true

## 4. Release and verification

- [ ] 4.1 Add a `patch` changeset for `@signalis/react` and `@signalis/core` describing the fixed stale renders and the single render on mount, and verify `pnpm changeset status` lists it
- [ ] 4.2 Run `pnpm bench --framework signalis` twice, interleaved with the baseline build, and verify no scenario regresses outside the run-to-run spread. Record the numbers here
- [ ] 4.3 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit` and `node_modules/.bin/prettier --check .`, and verify all pass
