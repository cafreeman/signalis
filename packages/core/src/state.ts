import type { Derived } from './derived.js';
import { isReaction, type Reaction } from './reaction.js';
import type { Signal } from './signal.js';
import type { Context, DerivedFunction } from './types.js';

// State
export const CLEAN = Symbol('Clean');
export type CLEAN = typeof CLEAN;
export const STALE = Symbol('Stale');
export type STALE = typeof STALE;
export const DIRTY = Symbol('Dirty');
export type DIRTY = typeof DIRTY;
export type STATUS = CLEAN | STALE | DIRTY;
export type NOTCLEAN = Exclude<STATUS, CLEAN>;

class State {
  contexts = new WeakMap<DerivedFunction, Context>();
  currentContext: Context | null = null;
  runningComputation: Derived<unknown> | Reaction | null = null;
  scheduledReactions: Array<Reaction> = [];
  pendingUpdates = new Map<Signal<unknown> | Derived<unknown> | Reaction, () => void>();
  batchCount = 0;
}

const STATE = new State();

// Contexts
// This function will either fetch the context associated with current reactive value, or create
// a new one if it doesn't already exist, and prepare it to run by clearing it and setting it
// as the new current context.
export function setupCurrentContext(k: DerivedFunction): Context {
  let context = STATE.contexts.get(k);

  if (!context) {
    context = new Set<Signal<unknown> | Derived<unknown>>();
    STATE.contexts.set(k, context);
  }

  // This is doubly important: we need it to not only make sure we don't carry around wrong lists
  // of dependencies, but also to make sure we avoid leaking the previous dependencies.
  context.clear();
  STATE.currentContext = context;
  return context;
}

export function getCurrentContext(): Context | null {
  return STATE.currentContext;
}

export function setCurrentContext(context: Context | null): void {
  STATE.currentContext = context;
}

export function getRunningComputation(): Derived<unknown> | Reaction | null {
  return STATE.runningComputation;
}

export function setRunningComputation(computation: Derived<unknown> | Reaction | null): void {
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

export function markDependency(v: Signal<unknown> | Derived<unknown>): void {
  if (STATE.currentContext) {
    STATE.currentContext.add(v);
  }
}

function doMarkUpdate(innerV: Signal<unknown> | Derived<unknown> | Reaction, innerState: NOTCLEAN) {
  if (innerV.observers) {
    innerV.observers.forEach((observer) => {
      // immediate observers are definitely dirty since we know the source just updated
      observer.status = innerState;
      if (isReaction(observer)) {
        scheduleReaction(observer);
      }

      if (observer.observers) {
        observer.observers.forEach((child) => {
          // indirect observers (children of children) are at least stale since we know something
          // further up the dependency tree has changed, but they might not actually be dirty
          child.status = STALE;
          if (isReaction(child)) {
            scheduleReaction(child);
          }
          doMarkUpdate(child, STALE);
        });
      }
    });
  }
}

export function markUpdate(
  v: Signal<unknown> | Derived<unknown> | Reaction,
  state: NOTCLEAN
): void {
  if (STATE.batchCount !== 0) {
    STATE.pendingUpdates.set(v, () => doMarkUpdate(v, state));
  } else {
    doMarkUpdate(v, state);
  }
}

function scheduleReaction(reaction: Reaction): void {
  if (!STATE.runningComputation) {
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
