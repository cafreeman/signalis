import type { Derived } from './derived.js';
import { type Reaction, isReaction } from './reaction.js';
import type { Signal } from './signal.js';

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
  currentContext: Set<any> | null = null;
  runningComputation: Derived<unknown> | Reaction | null = null;
  scheduledReactions: Array<Reaction> = [];
  batchCount = 0;
}

export const STATE = new State();

function batchStart() {
  STATE.batchCount++;
}

function batchEnd() {
  STATE.batchCount--;

  if (STATE.batchCount === 0) {
    runReactions();
  }
}

export function batch(cb: () => void) {
  batchStart();
  cb();
  batchEnd();
}

export function markDependency(v: Signal<unknown> | Derived<unknown>) {
  if (STATE.currentContext) {
    STATE.currentContext.add(v);
  }

  if (STATE.runningComputation) {
    if (v.observers) {
      v.observers.add(STATE.runningComputation);
    } else {
      v.observers = new Set([STATE.runningComputation]);
    }
  }
}

export function markUpdate(v: Signal<unknown> | Derived<unknown> | Reaction, state: NOTCLEAN) {
  if (v.observers) {
    v.observers.forEach((observer) => {
      // immediate observers are definitely dirty since we know the source just updated
      observer.status = state;
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
          markUpdate(child, STALE);
        });
      }
    });
  }
}

function scheduleReaction(reaction: Reaction) {
  // if (STATE.runningComputation === reaction) {
  //   throw new Error('cannot update a signal that is being used during a computation.');
  // }
  if (!STATE.runningComputation) {
    STATE.scheduledReactions.push(reaction);
  }
}

export function runReactions() {
  while (STATE.scheduledReactions.length > 0) {
    const reaction = STATE.scheduledReactions.pop();
    reaction?.validate();
  }
}
