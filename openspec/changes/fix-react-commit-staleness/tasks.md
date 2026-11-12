# Tasks

## 1. Baselines and review regressions

- [ ] 1.1 Record two `pnpm bench --framework signalis` baseline runs and two measurements of a scratch harness that repeatedly mounts unchanged reactor components with lazy `useDerived` values and exercises render-phase replays. Record commands, output paths, render counts and timing/allocation methodology here so group 5 can repeat the same workload
- [ ] 1.2 Add the CLEAN-but-changed derived scenario to `reactor.spec.tsx` and the cached-derived render-replay scenario to `useDerived.spec.tsx`. Before implementation, run each as a focused diagnostic and record the intended DOM assertion failure (`0` versus `2`, and `2` versus `10`). The permanent replay regression must assert the final `10`, not require the buggy single-computation count; verify no earlier diagnostic assertion can keep a fixed test failing

## 2. Core result versions and deferred observations

- [ ] 2.1 Add internal result versions to signals and deriveds. Test accepted/rejected signal writes, equal/different derived results, same/different cached errors, value/error transitions, thrown-promise invalidation and disposal/resurrection. Verify versions advance before notifications, never reset on disposal, and preserve the existing error and equality behavior with the focused core tests
- [ ] 2.2 Add deferred source/version observations, captured by getters after validation and before returning or rethrowing a cached error. Save/restore observation frames on nested computations and throws, honor `untrack`, and allocate no observation lists for non-deferred computations. Add core tests for lazy first reads, caught errors, and repeated reads around a write; verify an earlier observed version is not overwritten or discarded by graph-edge deduplication. Document this distinction in the relevant source comments

## 3. Pending collection lifecycle and commit checking

- [ ] 3.1 Keep pending context, divergence index and observations together. Add lifecycle tests showing that reaction traps replace superseded observations, a CLEAN derived keeps its earlier pending observations across repeated `_beginSourceCollection` calls, recomputation replaces the tuple, and commit/disposal release it. Verify that a replay reusing a cache still retains the source version from the original pending computation, even after that source changes; final DOM recovery is verified after commit integration in 3.3
- [ ] 3.2 Make `hasInvalidatedSource` return the strongest required mark across all observations: DIRTY for any version mismatch, STALE for a non-CLEAN derived with a matching version, otherwise CLEAN. Add core tests for all three outcomes, including a STALE source preceding a mismatched source, a CLEAN-but-changed derived, and an invalidated derived that returns the same value. Verify read order cannot hide a DIRTY result
- [ ] 3.3 Integrate the mark into reaction and derived commits, consume the pending tuple before draining queued work, and drain only outside a batch. Add tests for batched commits, re-entry, unchanged-result suppression and caught error-to-value transitions. Verify both regressions from 1.2 and the three stale-render known cases pass as ordinary tests; move the latter into the regular React specs and remove their expected-failure copies in the same step
- [ ] 3.4 Update deferred-collection comments in `state.ts`, `utils.ts`, `signal.ts`, `derived.ts`, `reaction.ts` and `useDerived.ts`, plus the reactivity guidance in `AGENTS.md`, to explain result-version observations and cached pending-read lifetimes. Verify they no longer describe signal-only epochs or current CLEAN status as sufficient history

## 4. React mount behavior and release notes

- [ ] 4.1 In `reactor.ts`, force the mount render only when recreating a reaction after Strict Mode cleanup, and update its comment. Add direct-signal and lazy-`useDerived` single-mount-render assertions plus a Strict Mode subscription/update test. Promote the remaining mount-count known-issue test and delete the now-empty React known-issues file. Verify the full React suite passes, including all five own-render write guards unchanged
- [ ] 4.2 Verify the new spec scenarios for an already-recomputed equal derived, a caught error becoming a value, and a render replay are covered by ordinary passing tests. Retain the existing Suspense/error-boundary source-observer assertions and batch/error-handling guards. Add a patch changeset for both published packages describing corrected stale renders and the single normal mount render; verify `pnpm changeset status` lists it

## 5. Integration and performance verification

- [ ] 5.1 Repeat the core benchmark and the React mount/replay harness twice, interleaved with their baseline builds. Record correctness counts and timings/allocation evidence against both baselines. If overhead exceeds the measured spread, pause for a design decision rather than weakening snapshot capture or lifecycle guarantees
- [ ] 5.2 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit`, `node_modules/.bin/prettier --check .` and `openspec validate fix-react-commit-staleness --strict`; verify all pass. If the edge optimization has landed, rerun the observation and lifecycle tests with it as well; do not make this correctness fix depend on accepting that optimization
