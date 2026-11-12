# Tasks

## 1. Baseline and guards

- [ ] 1.1 Record a benchmark baseline with `pnpm bench --framework signalis` run twice, and record the output paths here
- [ ] 1.2 Add the `effects` spec scenarios to `packages/core/tests/effect.spec.ts` (a signal read three times, a signal read directly and through a derived, two effects on one signal). Verify they pass on the current code
- [ ] 1.3 Write a fan-out timing script in the scratchpad (toggle a conditional dependency on a source with 3,000 observers versus one observer) and record its current numbers here

## 2. Common-case read deduplication

- [ ] 2.1 Add the run id to `State`. Save, assign and restore it around `Derived#compute`, `Reaction#compute` and `Reaction#trap`, including throw paths. Stamp sources and return early in `markDependency` before the index comparison. Verify the duplicate-read known case is fixed, then promote just that test to a plain test in the regular core specs and remove its expected-failure copy in the same step. Verify the branching-order test still passes unchanged
- [ ] 2.2 Add a nested-case test (an outer derived reads `s`, then a derived that reads `s`, then `s` again), asserting values and recompute counts without requiring deduplication across the nested read. Document the source-stamp overwrite limitation in the tracking comments, and verify the focused tests pass. If deferred read-version observations from the React change exist, verify repeated reads around a write still retain the earlier observation even when graph edges deduplicate
- [ ] 2.3 Run `pnpm bench --framework signalis` twice, interleaved with the baseline build. Verify no scenario regresses outside the run-to-run spread, and record the numbers here. Add a patch changeset describing common-case read deduplication, explicitly not all nested reads, and verify `pnpm changeset status` lists it
- [ ] 2.4 State in `docs/core/effects.md` that effect run order is unspecified, without promising a different run count or complete edge deduplication. Verify `pnpm docs:build` succeeds

## 3. Benchmark-gated back-indexed edges

- [ ] 3.1 Add a test-only helper that checks every edge's slots pair up across `_sources`, `_sourceSlots`, `_observers` and `_observerSlots`. Call it from new tests covering dynamic dependencies, partial reconciliation, `Derived#dispose`, `Reaction#dispose`, deferred collection and a derived that throws. Verify the tests run against the read-stamp build, with slot checks inactive until slots exist
- [ ] 3.2 Add `_sourceSlots` and `_observerSlots`, maintained in `reconcileSources`, and replace `findIndex` removal with slot-based swap-and-pop. Document slot maintenance in the relevant source comments. Verify the invariant tests pass with slot checks active and the branching-order test passes unchanged. Run the unlink known case in diagnostic mode to confirm its intended assertion now passes; its expected-failure status is resolved according to the gate in 3.3
- [ ] 3.3 Re-run the fan-out timing script and `pnpm bench --framework signalis` twice, interleaved with the 2.3 build, and record the result and decision in `design.md`. If no scenario regresses outside the spread, retain back-indices, promote the unlink test to a plain test, remove its expected-failure copy, and add constant-time removal to the existing changeset. Otherwise revert the slot implementation and slot-specific assertions, retain the general behavior guards and the original expected-failure unlink test, and leave constant-time removal out of the changeset. Verify the full core suite passes for whichever outcome is retained
- [ ] 3.4 Delete `packages/core/tests/known-issues.spec.ts` only if no expected-failure cases remain (the store sections are gone and both edge fixes were retained). Otherwise keep the remaining cases. Verify diagnostic mode still exposes each deferred issue's intended failure, and verify `pnpm changeset status` and the changeset text describe exactly the retained work

## 4. Integration verification

- [ ] 4.1 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit`, `node_modules/.bin/prettier --check .` and `openspec validate optimize-dependency-edges --strict`; verify all pass. Confirm any rejected optimization remains documented as an open known issue rather than marked fixed
