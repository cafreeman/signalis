import type { Derived } from './derived';
import type { Effect } from './effect';
import type { Tag } from './tag';

export type Context = Set<Tag>;

interface State {
  version: number;
  batchCount: number;
  contexts: WeakMap<Derived<unknown> | Effect, Context>;
  currentContext: Context | null;
  effects: Set<Effect>;
  runningEffect: Effect | null;
  onTagDirtied: () => void;
}

const STATE: State = {
  version: 0,

  batchCount: 0,

  contexts: new WeakMap<Derived<unknown> | Effect, Set<Tag>>(),
  currentContext: null,

  effects: new Set<Effect>(),
  runningEffect: null,

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTagDirtied: () => {},
};

// Tags
export function addTagToCurrentContext(t: Tag) {
  if (STATE.currentContext) {
    STATE.currentContext.add(t);
  }
}

export function onTagDirtied() {
  return STATE.onTagDirtied();
}

export function setOnTagDirtied(fn: () => void): void {
  STATE.onTagDirtied = fn;
}

// Version
export function getVersion(): number {
  return STATE.version;
}

export function incrementVersion(): number {
  return ++STATE.version;
}

// Context

export function hasCurrentContext(t: Tag): boolean {
  return !!STATE.currentContext && STATE.currentContext.has(t);
}

export function getCurrentContext(): Context | null {
  return STATE.currentContext;
}
export function setCurrentContext(context: Context | null) {
  STATE.currentContext = context;
}

// This function will either fetch the context associated with current reactive value, or create
// a new one if it doesn't already exist, and prepare it to run by clearing it and setting it
// as the new current context.
export function setupCurrentContext(k: Derived<unknown> | Effect): Set<Tag> {
  let context = STATE.contexts.get(k);

  if (!context) {
    context = new Set<Tag>();
    STATE.contexts.set(k, context);
  }

  context.clear();
  setCurrentContext(context);
  return context;
}

// Effects

export function isEffectRunning(): boolean {
  return !!STATE.runningEffect;
}

export function runningEffectHasDeps(): boolean {
  return !!STATE.runningEffect && STATE.runningEffect.hasDeps;
}

export function registerEffect(effect: Effect): Set<Effect> {
  return STATE.effects.add(effect);
}

export function removeEffect(effect: Effect): boolean {
  return STATE.effects.delete(effect);
}

export function setRunningEffect(effect: Effect | null): void {
  STATE.runningEffect = effect;
}

export function runEffects(): void {
  STATE.effects.forEach((effect) => {
    effect.compute();
  });
}

// Batching

export function batchStart(): void {
  STATE.batchCount++;
}

export function batchEnd(): void {
  STATE.batchCount--;
}

export function batchCount(): number {
  return STATE.batchCount;
}
