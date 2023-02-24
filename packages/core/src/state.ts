import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import type { Signal } from './signal.js';
import type { Context, ReactiveFunction, ReactiveValue } from './types.js';

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
  currentContext: Context | null = null;
  currentContextIndex = 0;
  runningComputation: ReactiveFunction | null = null;
  scheduledReactions: Array<Reaction> = [];
  pendingUpdates = new Map<Signal<unknown> | Derived<unknown> | Reaction, () => void>();
  batchCount = 0;
  suspended = false;
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
  if (STATE.suspended) {
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

// Update the status on all observers of a given source. If we're currently in the middle of a batch,
// the status update will instead be deferred until the batch is done.
export function markUpdates(source: ReactiveValue, status: NOTCLEAN): void {
  if (source._observers) {
    if (batchCount() !== 0) {
      STATE.pendingUpdates.set(source, () => runUpdatesForObserver(source._observers!, status));
    } else {
      runUpdatesForObserver(source._observers, status);
    }
  }
}

export function scheduleReaction(reaction: Reaction): void {
  if (STATE.scheduledReactions.includes(reaction)) {
    return;
  } else {
    STATE.scheduledReactions.push(reaction);
  }
}

export function runReactions(): void {
  while (STATE.scheduledReactions.length > 0) {
    const reaction = STATE.scheduledReactions.pop();
    reaction?.validate();
  }
}

function runPendingUpdates(): void {
  for (const update of STATE.pendingUpdates.values()) {
    update();
  }

  STATE.pendingUpdates.clear();
}

export function checkPendingUpdate(
  v: Signal<unknown> | Derived<unknown> | Reaction | undefined
): (() => void) | undefined {
  if (!v) {
    return;
  }

  const update = STATE.pendingUpdates.get(v);

  // If we find an update, we remove it from the queue since we're going to pass it back out to the
  // caller so it can be called eagerly and we want to avoid re-running it when we flush the
  // remaining pending updates
  if (update) {
    STATE.pendingUpdates.delete(v);
  }

  return update;
}

export function suspendTracking() {
  STATE.suspended = true;
}

export function resumeTracking() {
  STATE.suspended = false;
}
