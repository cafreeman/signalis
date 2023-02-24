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

  if (STATE.currentContext) {
    if (STATE.currentContext.includes(v)) {
      return;
    }
    STATE.currentContext.push(v);
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
