# Proposal

## Why

`createSignal` silently discards `false` and custom equality functions when its initial value is null or undefined, contrary to the documented API. The default comparator then remains active even after defined-value transitions, so signals can notify incorrectly and overwrite values a supplied comparator would have retained; this pre-existing bug is independent of store presence tracking.

## What Changes

- Honor the supplied equality policy for every explicitly provided initial value, including null and undefined, for the signal's lifetime.
- Preserve `createSignal()` as the distinct zero-argument notifier with initial null and notifications on every write.
- Preserve default `===` equality for explicit `createSignal(undefined)` / `createSignal(null)` with no comparator, existing public overloads, and constructor/setter error behavior.
- Add regression matrices covering notifications, comparator arguments/order, retained values, accepted transitions, derived recomputation, and typed nullable/optional unions.
- Clarify explicit nullish values versus the no-argument notifier in signal documentation. Correcting ignored policies can increase or decrease notifications and can prevent previously accepted value replacements; this restores existing documented behavior rather than adding an API.

## Capabilities

### New Capabilities

- `signals`: equality-policy behavior of writable signals, including explicit initial values, custom comparisons, and the separate no-argument notifier.

### Modified Capabilities

None. Existing batch and error-handling requirements remain unchanged; this change does not specify the entire signal engine.

## Impact

- Implementation: the `createSignal` factory in `packages/core/src/signal.ts`; no graph/constructor/setter redesign or public signature changes.
- Regressions: `packages/core/tests/signal.spec.ts`, with `.js` source imports and the existing comparator-throw tests in `errors.spec.ts` retained.
- Documentation: `docs/core/signals.md`; future implementation adds a core `patch` changeset explaining the corrected policies. The fixed core/react release group applies.
- No store-presence implementation or rollback to never-equal store values. Existing undefined-removal value/key histories must keep passing.
- Can be implemented before or independently of `fix-store-presence-tracking`. Coordinate source overlap with `fix-react-commit-staleness`, which also edits `signal.ts`, without making either a semantic prerequisite.
