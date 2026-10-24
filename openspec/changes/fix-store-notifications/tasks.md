# Tasks

## 1. Pin array key-set behavior first

- [ ] 1.1 Add tests to `packages/core/tests/store.spec.ts` asserting that an effect calling `Object.keys(store.items)` re-runs once per `update` that pushes, pops, splices, truncates through `length`, or deletes an index. Verify they pass on the current code before changing `store.ts`

## 2. Key-set tracking

- [ ] 2.1 Make `trackSelf` read the key-set signal on every call. Verify the known-issue tests "a second computation reading Object.keys re-runs when a key is added" and "...stays subscribed after it re-runs" now fail as `test.fails` (meaning they're fixed), and that the task 1.1 tests still pass
- [ ] 2.2 In `setProperty`, write the key-set signal only when the key's own-property presence changed or an array's length changed. Verify "a computation reading only Object.keys does not re-run when a value changes" now fails as `test.fails`, and that the 1.1 tests and the existing `keys`/`entries` tests still pass. Add tests for the spec's "Deleting a key" and "Reading values as well as keys" scenarios

## 3. Property equality

- [ ] 3.1 Create property signals with default equality in `getSignalNode`. Verify "writing the value a property already has does not re-run its observers" now fails as `test.fails`, and add a test for the spec's "Replacing an object with an equal copy" scenario

## 4. Tests, docs, release

- [ ] 4.1 Move the four store known-issue tests into `store.spec.ts` as plain `test`s and remove the store sections from `packages/core/tests/known-issues.spec.ts`. Verify `pnpm --filter @signalis/core test` passes
- [ ] 4.2 Document in `docs/core/stores.md` that same-value writes don't notify and that key enumeration re-runs only on key-set changes, with an example of each. Verify by building the docs with `pnpm docs:build` (or the docs build script in the root `package.json`)
- [ ] 4.3 Add a `minor` changeset for `@signalis/core` with **BREAKING** bullets for both behavior changes, each with its migration, and verify `pnpm changeset status` lists it
- [ ] 4.4 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit` and `node_modules/.bin/prettier --check .`, and verify all pass
