# Proposal

## Why

Reactive `in` / `Reflect.has` checks currently subscribe through property values, so deleting an undefined-valued or function-valued property can leave effects and derived presence values stale; array truncation also misses index-presence observers. Presence checks can even execute getters or throw, unlike ordinary JavaScript existence checks; these are pre-existing defects reproduced before and after `fix-store-notifications`.

## What Changes

- Track each observed key's prototype-chain presence independently of its value and of key enumeration. All readers stay subscribed across additions, removals, and re-runs.
- Notify presence-only observers when that key's boolean presence changes, not for value-only writes, unrelated keys, no-op deletion, or own-shadow removal that leaves an inherited property present.
- Include string and symbol keys, nested plain stores, function-valued keys, and array indices, including holes and length truncation. Presence checks do not evaluate getters.
- Update presence immediately after each supported mutation so derived reads inside an `update` see earlier writes; preserve deferred, deduplicated effects and existing batch/error behavior.
- Preserve property-value equality, key enumeration, existing internal-symbol results, and `Reflect.ownKeys` output. Exclude reactive `Object.hasOwn`, descriptor/`defineProperty` support, raw/prototype mutation, inherited-value cache repair, and truncated index-value repair.
- **BREAKING:** presence-only computations no longer re-run for value-only writes, and checking presence no longer evaluates a getter. Migrate value dependencies to explicit property reads, structural dependencies to enumeration, and intended getter evaluation to an explicit getter read.

## Capabilities

### New Capabilities

- `store-presence`: precise reactive prototype-chain presence checks through `in` and `Reflect.has`, including mutation, array, and batching semantics.

### Modified Capabilities

None. The existing main `batch` and `error-handling` requirements remain unchanged. A separate capability avoids rewriting the `stores` requirements introduced by the completed but unarchived `fix-store-notifications` change.

## Impact

- Implementation: `packages/core/src/store.ts` (`has`, presence bookkeeping, and mutation/array-shrink reconciliation); `update.ts` retains its existing batch wrapper.
- Regressions: `packages/core/tests/store.spec.ts`, with source imports, exact effect histories, and derived reads inside recipes. Existing value/key tests remain intact.
- Documentation: `docs/core/stores.md`; future implementation adds a pre-1.0 `minor` changeset for `@signalis/core` with **BREAKING** migration notes. The fixed group also releases `@signalis/react`.
- Build on the approved store value/key behavior in PR #75 without expanding that PR or requiring its spec archive first. `fix-nullish-signal-equality` is independent; graph/React changes are not prerequisites.
