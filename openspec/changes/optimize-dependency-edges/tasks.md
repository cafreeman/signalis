# Tasks

## 1. Baseline and guards

- [ ] 1.1 Record a benchmark baseline with `pnpm bench --framework signalis` run twice, and record the output paths here
- [ ] 1.2 Add the `effects` spec scenarios to `packages/core/tests/effect.spec.ts` (a signal read three times, a signal read directly and through a derived, two effects on one signal). Verify they pass on the current code
- [ ] 1.3 Write a fan-out timing script in the scratchpad (toggle a conditional dependency on a source with 3,000 observers versus one observer) and record its current numbers here

## 2. Read stamp

- [ ] 2.1 Add the run id to `State`. Save, assign and restore it around `Derived#compute`, `Reaction#compute` and `Reaction#trap`. Stamp sources and return early in `markDependency` before the index comparison. Verify the known-issue test "reading the same signal several times in one computation links it once" now fails as `test.fails` (meaning it's fixed), and that the order test in `effect.spec.ts` passes unchanged
- [ ] 2.2 Add a test for the nested case (an outer derived reads `s`, then a derived that reads `s`, then `s` again), asserting the value and recompute counts. Verify it passes
- [ ] 2.3 Run `pnpm bench --framework signalis` twice, interleaved with the baseline build. Verify no scenario regresses outside the run-to-run spread, and record the numbers here

## 3. Back-indexed edges

- [ ] 3.1 Add a test-only helper that checks every edge's slots pair up across `_sources`, `_sourceSlots`, `_observers` and `_observerSlots`. Call it from new tests covering dynamic dependencies, partial reconciliation, `Derived#dispose`, `Reaction#dispose`, deferred collection and a derived that throws. Verify the tests run against the current code (with the helper skipping the slot checks until the slots exist)
- [ ] 3.2 Add `_sourceSlots` and `_observerSlots`, maintained in `reconcileSources`, and replace the `findIndex` removal with the slot-based swap-and-pop. Verify the 3.1 tests pass with slot checks on, "dropping a dependency does not scan the source's whole observer list" now fails as `test.fails`, and the order test passes unchanged
- [ ] 3.3 Re-run the 1.3 fan-out script and record the numbers. Run `pnpm bench --framework signalis` twice, interleaved with the 2.3 build. Keep Decision 2 only if no scenario regresses outside the spread, otherwise revert it and record why here

## 4. Tests, docs, release

- [ ] 4.1 Move the two edge known-issue tests into the regular core specs as plain `test`s. Delete `packages/core/tests/known-issues.spec.ts` if the store change has already removed its sections. Verify `pnpm --filter @signalis/core test` passes
- [ ] 4.2 State in `docs/core/effects.md` that effect run order is unspecified, and verify `pnpm docs:build` succeeds
- [ ] 4.3 Add a `patch` changeset for `@signalis/core` describing constant-time edge removal and one edge per repeated read, and verify `pnpm changeset status` lists it
- [ ] 4.4 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit` and `node_modules/.bin/prettier --check .`, and verify all pass
