import type { Reaction } from './reaction.js';
import type { Context, ReactiveFunction, ReactiveValue } from './types.js';

// How updates flow through the graph
//
// The graph has three kinds of node: signals (writable values), deriveds (lazy, cached
// computations), and reactions (side effects, which `createEffect` builds on). A computation (a
// derived or a reaction) records the sources it reads while it runs (see `markDependency` and
// `reconcileSources`), and every source keeps the reverse list in `_observers`.
//
// Every computation has a status:
// - CLEAN: its cached result reflects the current values of all of its sources.
// - STALE: something upstream changed, so one of its sources *might* have a new value. It has to
//   validate its sources before it can trust its cache.
// - DIRTY: one of its direct sources definitely has a new value, so it must recompute.
//
// Status marks are pushed down the graph eagerly, and values are pulled up it lazily:
// 1. Push: a signal write marks the signal's direct observers DIRTY. A derived that leaves CLEAN
//    marks its own observers STALE, and so on down to the leaves. A derived passes the STALE mark
//    on only when it first leaves CLEAN, so the mark crosses each edge at most once per update. The
//    walk is a loop over an explicit stack, not recursion, and visits nodes depth first so that
//    reactions are scheduled in a fixed order (see `Derived._markObserversStale`).
// 2. Pull: a derived recomputes only when something reads it (`Derived#validate`). A STALE derived
//    validates its sources in the order it read them, and stops at the first one that recomputes
//    to a new value: `Derived#compute` marks its direct observers DIRTY when its result changes.
//    If every source turns out unchanged, the derived returns to CLEAN without recomputing.
// 3. Reactions are the leaves of the graph. Marking a reaction schedules it (`scheduleReaction`),
//    and `runReactions` validates the scheduled reactions once the write that marked them has
//    finished propagating, which is what pulls fresh values through the deriveds they read.
//
// Passing the STALE mark on only once relies on an invariant: while a derived isn't CLEAN, neither
// are its observers, so they already know to revalidate. Linking a source normally upholds it,
// because a computation links a source by reading it, and reading a derived validates it. Deferred
// source collection, which links sources some time after reading them, checks for sources that
// were invalidated in between (see `hasInvalidatedSource`).
//
// Inside `batch`, the marks a write would push are buffered instead (see `markUpdates`), and
// delivered when the outermost batch ends, followed by the scheduled reactions, so observers run
// once per batch rather than once per write. Reading a derived mid-batch delivers its direct
// sources' buffered marks early, so the read reflects the batch's writes so far.

// State
export const CLEAN = 0 as const;
export type CLEAN = typeof CLEAN;
export const STALE = 1 as const;
export type STALE = typeof STALE;
export const DIRTY = 2 as const;
export type DIRTY = typeof DIRTY;
export type STATUS = CLEAN | STALE | DIRTY;
export type NOTCLEAN = Exclude<STATUS, CLEAN>;

class State {
  // The sources read by the running computation that differ from its previous run, and the index
  // where they start to differ (see `markDependency`)
  currentContext: Context | null = null;
  currentContextIndex = 0;
  // The computation whose reads are being tracked, if any
  runningComputation: ReactiveFunction | null = null;
  // Reactions waiting to be validated. A reaction's `_isScheduled` flag records whether it's in
  // here, so each one is queued at most once
  scheduledReactions: Array<Reaction> = [];
  // Sources whose observers are owed a mark from a write inside the current batch, in the order
  // they were first written. The mark itself is stored on the source, as `_pendingStatus`, which is
  // CLEAN when nothing is owed
  pendingUpdates: Array<ReactiveValue> = [];
  // How many `batch` calls are currently open; marks are buffered while this is nonzero
  batchCount = 0;
  // Tracking suspension is implemented as a counter rather than a boolean so
  // that `untrack` calls nest correctly: an inner `untrack` ending must not
  // re-enable tracking while an outer `untrack` is still active
  suspendedCount = 0;
}

const STATE = new State();

// Contexts
export function getCurrentContext(): Context | null {
  return STATE.currentContext;
}

export function setCurrentContext(context: Context | null): void {
  STATE.currentContext = context;
}

export function getContextIndex(): number {
  return STATE.currentContextIndex;
}

export function setContextIndex(v: number): void {
  STATE.currentContextIndex = v;
}

export function getRunningComputation(): ReactiveFunction | null {
  return STATE.runningComputation;
}

export function setRunningComputation(computation: ReactiveFunction | null): void {
  STATE.runningComputation = computation;
}

export function batchStart(): void {
  STATE.batchCount++;
}

export function batchEnd(): void {
  STATE.batchCount--;

  if (STATE.batchCount === 0) {
    runPendingUpdates();
    runReactions();
  }
}

export function batchCount(): number {
  return STATE.batchCount;
}

export function markDependency(v: ReactiveValue): void {
  if (STATE.suspendedCount > 0) {
    return;
  }

  /**
   This algorithm is borrowed directly from https://github.com/modderme123/reactively/commit/fde309bb2966e5d382868169f9b8905532596ec5#diff-f63fb32fca85d8e177d6400ce078818a4815b80ac7a3319b60d3507354890992R90-R101
   It allows us to track minimize the amount of work we need to on subsequent runs of a
   computation by comparing a computation's pre-existing sources with the current source in
   the order in which they are referenced.

   `currentContextIndex` tracks the number of sources we've encountered in a given computation and
   maps it to an array index that we can use to compare against the computation's existing sources.
   For example, when we run a computation and call `.value` on a ReactiveValue for the first time,
   currentContextIndex will be 0. We'll then look to see if the 0-index of the running computation's
   existing sources is that same on the ReactiveValue we've just encountered. If it is, we know
   the relationship between this computation and it's first source hasn't changed, so we can just
   leave it there in the first position and increment `currentContextIndex` to indicate that
   we should look at index 1 the next time we encounter a source during this computation.

   The first time the sources at the current index don't match, we set the current context to a new
   array and push all subsequent sources into it. This means that, at the end of a computation, we
   have two pieces of data:
   1. The index of the computation's sources array where the dependencies between runs diverged
   2. A list of all the new sources that need to be added to that computation starting after the
   point where they diverged.

   Using these two pieces of data, we can update a computation's dependencies with the least amount
   of work possible, so we know how many sources we can re-use between runs and only have to account
   for the sources that have changed.
   **/
  if (STATE.runningComputation) {
    if (
      !STATE.currentContext &&
      STATE.runningComputation._sources &&
      STATE.runningComputation._sources[STATE.currentContextIndex] == v
    ) {
      STATE.currentContextIndex++;
    } else {
      if (STATE.currentContext) {
        STATE.currentContext.push(v);
      } else {
        STATE.currentContext = [v];
      }
    }
  }
}

function runUpdatesForObserver(observers: Array<ReactiveFunction>, status: NOTCLEAN) {
  for (let i = 0; i < observers.length; i++) {
    observers[i]?.markUpdate(status);
  }
}

// Mark every observer of a source with `status`; a source calls this with DIRTY when its value
// changes. Inside a batch, the mark is buffered on the source as its `_pendingStatus` instead, and
// the source is queued once in `pendingUpdates`; repeated writes to the same source within the batch
// just overwrite the buffered mark. The buffered marks are delivered when the batch ends, or earlier
// if a dependent derived is read mid-batch (see `runPendingUpdate`).
export function markUpdates(source: ReactiveValue, status: NOTCLEAN): void {
  if (source._observers) {
    if (batchCount() !== 0) {
      if (source._pendingStatus === CLEAN) {
        STATE.pendingUpdates.push(source);
      }
      source._pendingStatus = status;
    } else {
      runUpdatesForObserver(source._observers, status);
    }
  }
}

// Queue a reaction to be validated by the next `runReactions`. A reaction already in the queue stays
// where it is, so it's validated once no matter how many of its sources were marked.
export function scheduleReaction(reaction: Reaction): void {
  if (!reaction._isScheduled) {
    reaction._isScheduled = true;
    STATE.scheduledReactions.push(reaction);
  }
}

// Validate scheduled reactions until none are left, including any that are scheduled by the
// reactions themselves as they run. Each reaction leaves the queue before it's validated, so it can
// be scheduled again by writes it makes.
export function runReactions(): void {
  while (STATE.scheduledReactions.length > 0) {
    const reaction = STATE.scheduledReactions.pop()!;
    reaction._isScheduled = false;
    reaction.validate();
  }
}

// Deliver every mark buffered by the batch that just ended. Delivering a mark can queue more
// sources, which are appended to the list and delivered in the same pass.
function runPendingUpdates(): void {
  const pending = STATE.pendingUpdates;

  for (let i = 0; i < pending.length; i++) {
    runPendingUpdate(pending[i]);
  }

  pending.length = 0;
}

// Deliver a source's buffered batch mark to its observers, if it has one, and report whether it did.
// Delivering the mark resets the source's `_pendingStatus` to CLEAN, so a mark delivered early (when
// a dependent derived is read mid-batch) isn't delivered again when the batch ends. The source can
// stay in `pendingUpdates` after an early delivery: the end-of-batch pass skips CLEAN sources.
export function runPendingUpdate(v: ReactiveValue | undefined): boolean {
  if (!v || v._pendingStatus === CLEAN) {
    return false;
  }

  const status = v._pendingStatus;
  v._pendingStatus = CLEAN;
  runUpdatesForObserver(v._observers!, status);

  return true;
}

export function suspendTracking() {
  STATE.suspendedCount++;
}

export function resumeTracking() {
  STATE.suspendedCount--;
}
