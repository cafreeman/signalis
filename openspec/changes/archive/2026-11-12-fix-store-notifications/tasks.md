# Tasks

## Verification protocol

Before changing implementation code, run `openspec validate fix-store-notifications --strict` and diagnose the four store known issues as ordinary tests:

```bash
SHOW_KNOWN_ISSUES=1 pnpm --filter @signalis/core exec vitest run tests/known-issues.spec.ts -t 'known issues: store'
```

Confirm each fails at its intended behavioral assertion, not from an unrelated exception. During staged fixes, a fixed `test.fails` must report an unexpected pass; a nonzero command exit alone is not evidence of a fix. The final ordinary passing tests in task 4.1 are the decisive regression gate.

Capture snapshots inside effects and assert their complete histories, establishing both exact run counts and observed contents after each relevant update. Key-only effects must not read property values; entries tests should capture primitive values. A multi-write `update` must produce one relevant re-run observing the completed update, not an intermediate state.

Keep truncated-array index-value notifications out of scope. Optional equality hardening may cover `NaN` to `NaN` notifying and `0` to `-0` not notifying, consistent with `===`; these are not additional completion requirements.

## 1. Pin array key-set behavior first

- [x] 1.1 Add tests to `packages/core/tests/store.spec.ts` asserting that an effect calling `Object.keys(store.items)` re-runs once per `update` that pushes, pops, performs a structural splice that changes keys or length, actually truncates through `length`, or deletes an existing index. Use a fresh store/effect for each operation, and do not enumerate its keys before the effect subscribes. Assert the initial and final key snapshots. Verify all cases pass on the current code before changing `store.ts`; equal-length replacement splices on dense arrays are not passing-baseline cases

## 2. Key-set tracking

- [x] 2.1 Make `trackSelf` read the key-set signal on every call. Verify the known-issue tests "a second computation reading Object.keys re-runs when a key is added" and "...stays subscribed after it re-runs" now fail as `test.fails` because their assertions pass, and that the task 1.1 tests still pass. Add snapshot histories for multiple readers and consecutive structural mutations on the same object and array, including additions and deletions. Cover subscription persistence through `Object.keys`, `Object.entries`, `for...in`, and `Reflect.ownKeys`; preserve the existing internal symbols returned by `Reflect.ownKeys`, rather than expecting only user keys
- [x] 2.2 In `setProperty`, write the key-set signal only when the key's own-property presence changed or an array's length changed. Verify "a computation reading only Object.keys does not re-run when a value changes" now fails as `test.fails` because its assertions pass, and that the 1.1 tests and the existing `keys`/`entries` tests still pass. Add tests for the spec's "Deleting a key" and "Reading values as well as keys" scenarios, plus these boundaries:
  - Removing an existing own key whose value is already `undefined`, by deletion or assignment of `undefined`, re-runs key readers once but not property-value-only readers
  - Deleting an absent key or assigning `undefined` to an absent key re-runs neither key-only nor property-value-only readers
  - Removing a defined property updates both the observed key list and property value; changing an existing value leaves key-only readers unchanged but re-runs property and entries readers once with the new value
  - Replacing an existing array index or using an equal-length replacement splice on a dense array causes no key-only re-run
  - A multi-write `update` affecting both keys and values causes one re-run per relevant effect, with snapshots showing only the completed update

## 3. Property equality

- [x] 3.1 Create property signals with default equality in `getSignalNode`. Verify "writing the value a property already has does not re-run its observers" now fails as `test.fails` because its assertions pass. Assert property-value snapshot histories for unchanged and changed primitives, same-reference object and array assignments (no re-run), and distinct but structurally equal object and array replacements (one re-run), including the spec's "Replacing an object with an equal copy" scenario

## 4. Tests, docs, release

- [x] 4.1 Move the four store known-issue tests into `store.spec.ts` as plain `test`s, retain their exact-count assertions or equivalent full snapshot histories, add observed-content assertions where missing, and remove the store sections from `packages/core/tests/known-issues.spec.ts`. Verify `pnpm --filter @signalis/core test` passes
- [x] 4.2 Document in `docs/core/stores.md` that same-value writes don't notify and that key enumeration re-runs only on key-set changes, with an example of each. Verify by building the docs with `pnpm docs:build` (or the docs build script in the root `package.json`)
- [x] 4.3 Add a `minor` changeset for `@signalis/core` with **BREAKING** bullets for both behavior changes, each with its migration, and verify `pnpm changeset status` lists it
- [x] 4.4 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm -r exec tsc --noEmit`, `node_modules/.bin/prettier --check .` and `openspec validate fix-store-notifications --strict`, and verify all pass
