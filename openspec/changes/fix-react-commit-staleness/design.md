# Design

## Context

See `proposal.md` for the stale-render cases. During render, `reactor` reactions and `useDerived` deriveds defer source linking: `trap` or `compute` saves a pending context, and a passive effect commits it. Existing leading sources remain linked. `hasInvalidatedSource` currently checks only newly linked sources' current status, which has no history of signal writes or derived results recomputed before subscription.

Two lifetimes differ. A reaction runs its render trap again on a replay, but a CLEAN `useDerived` can reuse its cache and earlier pending context. `useDerived` calls `_beginSourceCollection` in both cases. Resetting observation metadata at that hook invocation would detach it from the computation that produced the cache.

Hook order also matters: `reactor` registers its effects before the component registers `useDerived`'s effects. The reaction can therefore link to the derived before that derived commits its own sources. A derived commit must notify that reaction and drain the queue outside a batch; today it does not drain it.

## Goals / Non-Goals

**Goals:**

- Compare what a deferred read observed with the source's current result, not just its current CLEAN/STALE/DIRTY status.
- Keep pending source observations and their cached result together through render replays, recomputation, errors, commit and disposal.
- Remove the unconditional mount render while preserving Strict Mode recovery, abandoned-render safety, own-render writes, batch behavior and error-handling invariants.
- Preserve suppression when an invalidated derived recomputes to the same result.

**Non-Goals:**

- Changing when subscriptions become live, or changing ordinary core equality, scheduling and error semantics.
- Deduplicating dependency edges or adopting the slot arrays in `optimize-dependency-edges`. This change works with today's duplicate edges and either outcome of that proposal.
- Allocating observation snapshots for ordinary, non-deferred computations.

## Decisions

### 1. Version the result of both signals and deriveds

Each signal and derived gets an internal monotonically increasing result version. A signal increments its version when its equality policy accepts a write, before notifying observers. A derived increments its version when it changes the result that its readers can observe, before notifying them: a different value, a different cached error, or a transition between a value and an error. A derived that recomputes to the same result keeps its version. Merely becoming STALE or DIRTY does not increment it.

Versions do not reset on `Derived#dispose`: disposing still marks dependents STALE without running effects, and a later read may resurrect the same node. Reusing an old version could hide a result change from an outstanding reader. Preserve the existing cached-error and thrown-promise rules, including reads before a throw and invalidation when a promise settles.

- **Why both node kinds:** a derived can change, notify its existing observers, and become CLEAN before a new reader subscribes. Its new version still exposes that the rendered result is old.
- **Alternative rejected: signal-only write epochs and derived status.** That cannot detect the CLEAN-but-changed derived case.
- **Alternative rejected: incrementing a derived on invalidation.** That would treat unchanged derived results as changed and lose lazy equality suppression.

### 2. Capture the version actually observed by each deferred read

Keep source-link collection in `markDependency`, but record observation metadata separately from that pre-validation call. A signal getter records its current version with its returned value. A derived getter records its version **after validation**, immediately before returning its result or rethrowing its cached error. The snapshot therefore describes what the caller actually saw, not the version before a lazy first computation. Tracking suspension applies to both operations.

An observation contains the source and its observed version. Record observations only for the currently running computation when it is deferring source collection. Save and restore this bookkeeping alongside the existing computation/context frame on nested computations and every throw path. A non-deferred computation does not allocate a snapshot list.

Observations cover all tracked reads in that computation, including sources in the unchanged leading portion of `_sources`, not only the newly linked tail. Repeated reads must not overwrite evidence of an earlier read: if a source changes between two reads in one computation, retain both observations or the earliest version. Graph-edge deduplication must not suppress this consistency evidence. Internal calls to `validate` are not user reads and do not invent observations.

- **Why post-validation:** recording a lazy derived's old version would force a second mount render even though the component already rendered its freshly computed result.
- **Why per-read observations rather than a render-start epoch:** they distinguish actual reads from unrelated writes and, crucially, describe cached reads that survive a later render invocation. The extra storage is restricted to deferred collection.

### 3. Bind observations to the pending computation, not each render start

Treat pending context, its divergence index and its source observations as one tuple. Publish or replace them together, following the existing successful-trap and derived-computation rules. Do not associate the tuple with a new render merely because `_beginSourceCollection` was called again.

| Event | Reaction | Derived |
| --- | --- | --- |
| Begin/repeat collection | Prepare a fresh render trap; discard superseded uncommitted reaction observations. | Enable deferred collection; preserve an existing pending tuple while its cache is reused. |
| Trap/compute executes | Publish the successful trap's tuple; a throwing render does not publish partial subscriptions. | Replace the tuple with this computation's reads, including reads before a cached error, using the restored computation frame. |
| Render reuses a CLEAN cache | The reaction still traps the render and observes the derived's current result version. | Do not replace its earlier source observations or manufacture a fresh observation time. |
| Commit | Reconcile and check the selected pending tuple, then clear it. | Reconcile and check the tuple associated with the cached computation, then clear it. |
| Dispose | Drop pending tuples and release source references. | Drop pending tuples and release source references; retain the monotonically increasing result version. |

For the replay regression: the first computation records `s` at version V0 and caches `2`; a render writes `s = 5` at V1 and schedules a state adjustment. The replay reuses `2`, so its derived keeps the V0 observation. Commit detects V1 versus V0, recomputes and delivers `10`. There is no new render-start epoch that can erase V0.

### 4. Combine version mismatches and current invalidation status

After reconciling the pending sources, `hasInvalidatedSource` evaluates the retained observations and reports the strongest required mark:

- **DIRTY:** any observed source's result version differs, whether it is a signal or a derived and whether it is currently CLEAN or not.
- **STALE:** no version mismatch was found, but an observed derived is not CLEAN and needs validation to determine whether its result changed.
- **CLEAN:** versions match and every observed derived is current.

DIRTY takes precedence regardless of read order; a STALE derived must not cause an early return that hides a later version mismatch. A STALE mark alone cannot catch a missed signal write or an already-CLEAN changed derived, because validating those sources need not emit another notification.

Reaction and derived commits raise their status with that mark using the normal notification path. Outside a batch they drain scheduled reactions after marking, including after a derived commit. Inside a batch they leave the queue to the outermost batch end. Drop the consumed tuple before running queued user work so re-entry cannot reuse it. Preserve the existing CLEAN/status restoration and error routing rather than introducing a new read-time flush.

### 5. Mount render only after a Strict Mode remount

`reactor` calls `forceUpdate` in its mount effect only if it had to create a fresh reaction after Strict Mode cleanup. A normal mount relies on observation checking. On an unchanged lazy `useDerived` mount, the reaction observes the derived's version after its first computation and all source observations still match, so neither commit forces a render.

## Risks / Trade-offs

- **[Deferred allocations and hot getter/version overhead]** One version field per reactive value, updates on accepted result changes, and snapshot storage for deferred reads. → Measure the ordinary core benchmark against a fresh baseline and separately measure repeated React mounts and render replays. If overhead exceeds the measured spread, pause for a design decision rather than remove either consistency guarantee.
- **[Snapshot lifecycle drifts from pending sources]** Replays, errors and disposal can otherwise retain the wrong tuple or source references. → Core lifecycle tests and the replay regression exercise replacement, reuse, consumption and cleanup; the existing Suspense/error-boundary observer assertions remain mandatory.
- **[Version capture happens too early or is lost to deduplication]** → Test a first lazy computation, an error result, repeated reads around a write, and both the existing graph and any retained edge optimization.
- **[Changed derived results are confused with invalidation]** → Test CLEAN-but-changed deriveds and invalidated-but-unchanged deriveds, including value/error transitions. Do not add renders for merely recomputing an equal result.
- **[Commit work runs effects at the wrong time]** → Test reaction and derived commits inside a batch and preserve the no-effects-on-dispose contract. Existing batch/error-handling specifications and tests remain acceptance criteria.
- **[Behavior relied on the extra mount render]** → Keep all five own-render write guards, add a lazy-derived single-render assertion and a Strict Mode subscription test, and run the full React suite without the unconditional render.

## Migration Plan

No public API change. Ship a `patch` changeset for `@signalis/react` and `@signalis/core` after the behavioral and performance checks pass. Rollback is a plain revert. This revision changes planning artifacts only; regression tests and version bookkeeping are implementation tasks, not implemented here.
