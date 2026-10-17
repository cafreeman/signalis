# Tasks

## 1. Baseline

- [ ] 1.1 Add an ordering regression test to `packages/core/tests/effect.spec.ts`. Build a branching graph: one signal feeding several deriveds, siblings at multiple depths, and at least three effects under shared deriveds. Record the order in which effects run and nodes recompute over several writes, both batched and unbatched, and capture the expected order from the current implementation. Verify that `pnpm test` passes before any source change.
- [ ] 1.2 Record a baseline with `pnpm bench` (full run, current config). Note the Signalis medians per scenario, and verify that the run reports every cell `ok`.

## 2. Pending queue keeps its storage

- [ ] 2.1 In `packages/core/src/state.ts`, change `pendingUpdates` to a fixed array plus a `pendingCount`. `markUpdates` writes at the count. `runPendingUpdates` walks indices up to the live count, clears each slot to `undefined` before delivering it, then resets the count to 0. Verify that `pnpm test` passes, including the existing batch and mid-batch-read tests.
- [ ] 2.2 Add a test to `packages/core/tests/batch.spec.ts`:
  - A large batch, then a later small batch, each deliver every write exactly once.
  - A source whose mark was delivered early by a mid-batch read isn't delivered again at the end of the batch.

  Verify with the spy-effect call counts.

- [ ] 2.3 Update the comments on `pendingUpdates`, `markUpdates` and `runPendingUpdates` so they describe the array-plus-count queue and why its storage stays allocated. Present tense only, no before/after wording. Verify by reading the diff.

## 3. Iterative STALE propagation

- [ ] 3.1 In `packages/core/src/derived.ts`, add a `private static` propagation method on `Derived`.
  - It walks observers depth-first and pre-order, using two module-level stacks (observer arrays and next indices).
  - A CLEAN derived observer is set to STALE and descended into immediately. A derived observer that isn't CLEAN is skipped. A reaction observer gets `markUpdate(STALE)`.
  - Stack slots are cleared as frames pop.
  - `markUpdate` calls it when the node first leaves CLEAN. `_status` stays `private`.

  Verify that `pnpm test` passes, including the 1.1 ordering test unchanged.

- [ ] 3.2 Add a test to `packages/core/tests/derived.spec.ts`: a diamond plus a deep chain (several hundred nodes) with effects at multiple depths updates correctly. Verify that values and effect call counts match the expected values.
- [ ] 3.3 Comment the propagation method:
  - Pre-order visit order, and why it must match the order reactions are scheduled in.
  - The no-re-entrancy assumption that makes the shared stacks safe.
  - Why derived and reaction observers are handled differently.

  Update the `markUpdate` comment and the "How updates flow through the graph" overview in `state.ts` where it mentions propagation. Verify by reading the diff.

## 4. Clean-read fast path

- [ ] 4.1 In `Derived#value`, call `validate()` only when `_status !== CLEAN || batchCount() !== 0`. Verify that `pnpm test` passes (core and React).
- [ ] 4.2 Add tests to `packages/core/tests/derived.spec.ts`:
  - Repeated reads of a clean derived don't rerun its computation (spy count).
  - A read inside a batch still reflects a write made earlier in the same batch.
- [ ] 4.3 Comment the getter's condition: it skips `validate()` exactly when `validate()` would do nothing, and it keeps the common read inlinable. Verify by reading the diff.

## 5. Integration

- [ ] 5.1 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit` and `node_modules/.bin/prettier --check .`, and verify that all pass.
- [ ] 5.2 Run `pnpm bench` (full run) and compare it to the 1.2 baseline. Verify that every cell reports `ok`, and that no scenario regresses beyond its min/max spread.
- [ ] 5.3 Extend `.changeset/faster-update-propagation.md` (`@signalis/core`: patch) with bullets for the batch queue, iterative propagation and the clean-read fast path. Verify that `pnpm changeset status` lists the patch bump.
