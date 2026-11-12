# Design

## Context

See `proposal.md` for motivation and `specs/signals/spec.md` for the contract. This small change still needs explicit design decisions because zero arguments, explicit undefined, comparator lifetime, retained values, and public generic overloads must not be conflated.

`createSignal` has three runtime paths in `packages/core/src/signal.ts`: zero arguments create `_Signal(null, neverEqual)`; an explicit nullish initial value creates `_Signal(value)` and drops the comparator; other explicit values forward `isEqual`. The constructor already handles default `===`, `false`, and comparator functions correctly. The setter compares the retained private value before replacing it or marking observers.

`docs/core/signals.md` promises custom/always-notify equality without a nullish exception. `signal.spec.ts` covers `false` for a string and custom equality for an object, but not nullish initial values. `errors.spec.ts` already checks that a comparator throw leaves the signal unchanged. No graph or error-routing change is needed.

## Goals / Non-Goals

**Goals:** forward equality policies for all explicit initial values; distinguish omitted arguments from explicit undefined; prove comparator arguments, policy retention, and retained values, not just effect counts; preserve typed public overloads.

**Non-Goals:** fixing store presence, reverting default store equality, new equality APIs, switching to `Object.is`, changing constructor/setter behavior, redefining derived equality, graph/result-version changes, or correcting unrelated documentation examples. Preserve existing error/batch contracts.

## Decisions

### 1. Keep only the zero-argument special case

Retain the `arguments.length === 0` branch exactly in meaning: initial null, never-equal notifier. Every explicit initial value must construct `_Signal` with the supplied comparator, including omitted comparator/undefined (which selects its existing default).

Do not detect the notifier by `value === undefined` or `value == null`: `createSignal(undefined)` and `createSignal(null)` are ordinary default-equality signals. Do not change the constructor to compensate for a factory forwarding bug.

Preserve public overloads and the `Signal` interface. If the implementation signature's widened optional `T | null | undefined` requires a type-narrowing assertion, keep it local to the explicit-value factory path and justify it by the unchanged overload contract. Do not weaken comparator types, expose `_isEqual`, use `any` to hide the problem, or redesign declaration output.

### 2. Test a full nullish policy matrix

For each initial `X` (null and undefined), create typed number/nullish unions, register a direct effect, and perform separate writes `X`, `X`, `2`, `2`:

| Policy                | Direct history    | Comparator calls / retained value                      |
| --------------------- | ----------------- | ------------------------------------------------------ |
| Omitted               | `[X, 2]`          | Existing default `===`; ends at `2`                    |
| `false`               | `[X, X, X, 2, 2]` | Every write accepted; ends at `2`                      |
| Always-false function | `[X, X, X, 2, 2]` | `(X,X), (X,X), (X,2), (2,2)`                           |
| Always-true function  | `[X]`             | `(X,X), (X,X), (X,2), (X,2)`; retained value stays `X` |

The current source produces `[X,2]` and zero custom-function calls for all four policies. Diagnose intended failures before production edits; do not mistake a failed generic test setup or cleanup return value for the library bug. Capture effect snapshots with block-bodied callbacks, and dispose them.

The always-true case proves that equality suppresses replacement, not merely notifications. It does not prove policy lifetime after an accepted transition, so add a state-sensitive comparator returning true for equal values or proposed `3`: writes `2`, `3`, `2` must call `(X,2), (2,3), (2,2)` and retain `2` throughout after the first write. Assert each post-write value and exact call order. Creation and reads must leave comparator call count zero.

Use `.js` source imports in touched tests and real `number | undefined` / `number | null` generics, not public-type weakening or casts that hide union errors. Keep existing defined-value comparator tests as controls.

### 3. Test notifier and derived behavior separately

Pin `createSignal()` initial null and repeated null/undefined-write histories; compare it directly with explicit undefined and explicit null defaults. These controls must pass before and after the fix.

Add a primed derived over a nullish source with an always-notify policy. Count derived recomputations separately from downstream effects: a source write can invalidate/recompute the derived while an unchanged derived result suppresses its observer. Also verify an accepted defined transition becomes visible and a suppressed transition leaves derived reads at the retained old value. Do not assert that every accepted source write forces an equal-result downstream effect to run.

Keep existing comparator-throw coverage passing. A nullish-initial comparator-throw variant is optional hardening, not a new error-handling requirement or prerequisite for claiming the forwarding fix complete.

### 4. Keep store and other active changes independent

Current store property nodes call `createSignal(value)` without a custom comparator; they must retain default equality. The structural notifier uses `createSignal()` and must remain never-equal. Therefore existing store value/key histories, especially removing own `a: undefined` without a value-only rerun, remain unchanged.

The proposed store presence nodes are booleans and require no nullish workaround. Neither follow-up depends semantically on the other. `fix-react-commit-staleness` also plans changes to `signal.ts`; resolve textual overlap carefully and retain its intended accepted/rejected-write behavior if integrated, without adding result versions here. Keep tests independent of observer-array layouts in `optimize-dependency-edges`.

No full graph benchmark is needed to diagnose comparator forwarding, and no performance improvement is claimed. If performance measurements are collected, capture the same workload's unchanged baseline before production edits and compare fresh-process paired runs; do not substitute graph timings for comparator correctness.

## Risks / Trade-offs

- **[Previously ignored policies now affect behavior]** -> Patch notes explicitly describe both increased/decreased notifications and values retained instead of overwritten. Correctness follows the existing documented comparator, not the buggy default.
- **[Accidentally treating explicit undefined as notifier]** -> Independent no-argument versus explicit-nullish controls, including initial value and repeated writes.
- **[Only counts tested, value replacement remains wrong]** -> Per-write retained-value assertions and exact comparator argument histories, including suppressing and state-sensitive policies.
- **[Factory generic inference masks a signature change]** -> Real typed nullable/optional unions, declaration build, workspace type checks, and unchanged public overloads.
- **[Confusing source acceptance with derived-result notifications]** -> Separate recomputation and effect histories; preserve existing derived equality.

## Migration Plan

Ship a core `patch` changeset during implementation, with core/react released together by the fixed group. Explain that the explicitly supplied comparator now applies to null/undefined initial signals and remains active after transitions. Callers wanting ordinary `===` should omit a comparator; callers supplying one should expect it to control both stored values and notifications as documented.

Document explicit `createSignal(undefined, false)`, custom nullish equality, and the distinction from the no-argument notifier in `docs/core/signals.md`. Keep this independent from the presence minor release and do not amend PR #75. No persisted data migration or API change is involved; rollback is a normal revert.
