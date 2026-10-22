# Tasks

## 1. Baseline

- [x] 1.1 Add an ordering regression test to `packages/core/tests/effect.spec.ts`. Build a branching graph: one signal feeding several deriveds, siblings at multiple depths, a diamond (a node reachable by two paths), at least three effects under shared deriveds, and a derived that no effect reads (outside a batch it is still STALE when the next write arrives, which exercises the skip-non-CLEAN branch). Record the order in which effects run and nodes recompute over several writes, both batched and unbatched, and capture the expected order from the current implementation. Verify that `pnpm test` passes before any source change.
- [x] 1.2 Record a baseline with `pnpm bench` (full run, current config). Note the Signalis medians per scenario, and verify that the run reports every cell `ok`. Refresh the "Current (ms)" column in proposal.md from this run, since the figures there predate the #69 fixes.

## 2. Pending queue keeps its storage

- [x] 2.1 In `packages/core/src/state.ts`, change `pendingUpdates` to a fixed array plus a `pendingCount`. `markUpdates` writes at the count. `runPendingUpdates` walks indices up to the live count, clears each slot to `undefined` before delivering it, then resets the count to 0. Verify that `pnpm test` passes, including the existing batch and mid-batch-read tests.
- [x] 2.2 Add a test to `packages/core/tests/batch.spec.ts`:
  - A large batch, then a later small batch, each deliver every write exactly once.
  - A source whose mark was delivered early by a mid-batch read isn't delivered again at the end of the batch.
  - A source written, read mid-batch (early delivery), then written again in the same batch delivers its final mark exactly once to its observers.

  Verify with the spy-effect call counts.

- [x] 2.3 Update the comments on `pendingUpdates`, `markUpdates` and `runPendingUpdates` so they describe the array-plus-count queue and why its storage stays allocated. Present tense only, no before/after wording. Verify by reading the diff.

## 3. Iterative STALE propagation

- [x] 3.1 In `packages/core/src/derived.ts`, add a `private static` propagation method on `Derived`.
  - It walks observers depth-first and pre-order, using two module-level stacks (observer arrays and next indices). The depth counter is local to the call, so each call starts at depth 0 and only the arrays are shared.
  - A CLEAN derived observer is set to STALE and descended into immediately. A derived observer that isn't CLEAN is skipped. Anything else is a reaction and gets `markUpdate(STALE)`. Observer arrays are never sparse (they only `push` and swap-and-pop), so the loop has no `?.` guards.
  - Stack slots are cleared as frames pop.
  - `markUpdate` calls it when the node first leaves CLEAN. `_status` stays `private`.

  Verify that `pnpm test` passes, including the 1.1 ordering test unchanged.

- [x] 3.2 Add a test to `packages/core/tests/derived.spec.ts`: a diamond plus a deep chain (several hundred nodes) with effects at multiple depths updates correctly. Verify that values and effect call counts match the expected values.
- [x] 3.2a (Optional) Add a marking-only depth test: build a chain of tens of thousands of deriveds, reading each one right after creating it so every first compute stays shallow, put no effect on it, and assert that writing the head signal doesn't throw. Don't read the tail or add an effect there: the pull recurses and would overflow regardless of marking.
- [x] 3.3 Comment the propagation method:
  - Pre-order visit order, and why it must match the order reactions are scheduled in.
  - The no-re-entrancy assumption that makes the shared stacks safe.
  - Why derived and reaction observers are handled differently.

  Update the `markUpdate` comment and the "How updates flow through the graph" overview in `state.ts` where it mentions propagation. Verify by reading the diff.

## 4. Clean-read fast path

- [x] 4.1 In `Derived#value`, call `validate()` only when `_status !== CLEAN || batchCount() !== 0`. Verify that `pnpm test` passes (core and React).
- [x] 4.2 Add tests to `packages/core/tests/derived.spec.ts`:
  - Repeated reads of a clean derived don't rerun its computation (spy count).
  - A read inside a batch still reflects a write made earlier in the same batch.
- [x] 4.3 Comment the getter's condition: it skips `validate()` exactly when `validate()` would do nothing, and it keeps the common read inlinable. Verify by reading the diff.

## 5. Integration

- [x] 5.1 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit` and `node_modules/.bin/prettier --check .`, and verify that all pass.
- [ ] 5.2 Run `pnpm bench` (full run) and compare it to the 1.2 baseline. Verify that every cell reports `ok`. Keep each fix only if it improves at least one scenario outside its min/max spread and regresses none; revert any fix that doesn't, and say so in the write-up.
- [x] 5.3 Add bullets for the batch queue, iterative propagation and the clean-read fast path (`@signalis/core`: patch). If `pnpm changeset status` still lists `.changeset/faster-update-propagation.md`, extend it; otherwise add a new changeset. Verify that `pnpm changeset status` lists the patch bump.
