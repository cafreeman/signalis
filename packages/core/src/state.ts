import type { Derived } from './derived';
import type { Effect } from './effect';
import type { Sink } from './sink';
import type { Tag, Tagged } from './tag';

export type Context = Set<Tagged>;
type ContextOwner = Derived<unknown> | Effect | Sink;

interface State {
  version: Tag;
  batchCount: number;
  contexts: WeakMap<ContextOwner, Context>;
  currentContext: Context | null;
  effects: Set<Effect>;
  runningEffect: Effect | null;
  onTagDirtied: (verson: Tag) => void;
}

// SAFETY: this state object is responsible for the global `Tag` count, and so
// consistently casts its `version` as `Tag` internally.
const STATE: State = {
  version: 0 as Tag,

  batchCount: 0,

  contexts: new WeakMap<ContextOwner, Set<Tagged>>(),
  currentContext: null,

  effects: new Set<Effect>(),
  runningEffect: null,

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTagDirtied: () => {},
};

console.log('state', STATE);

// Tags
export function addTagToCurrentContext(t: Tagged) {
  if (STATE.currentContext) {
    STATE.currentContext.add(t);
  }
}

export function onTagDirtied() {
  return STATE.onTagDirtied(STATE.version);
}

export function setOnTagDirtied(fn: (version: Tag) => void): void {
  STATE.onTagDirtied = fn;
}

// Version
export function getVersion(): Tag {
  return STATE.version;
}

export function incrementVersion(): Tag {
  return ++STATE.version as Tag;
}

// Context
export function hasCurrentContext(t: Tagged): boolean {
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
export function setupCurrentContext(k: ContextOwner): Context {
  let context = STATE.contexts.get(k);

  if (!context) {
    context = new Set<Tagged>();
    STATE.contexts.set(k, context);
  }

  // This is doubly important: we need it to not only make sure we don't carry around wrong lists
  // of dependencies, but also to make sure we avoid leaking the previous dependencies.
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
  console.log('register effect', effect);
  return STATE.effects.add(effect);
}

export function removeEffect(effect: Effect): boolean {
  return STATE.effects.delete(effect);
}

export function setRunningEffect(effect: Effect | null): void {
  STATE.runningEffect = effect;
}

export function runEffects(): void {
  console.log('RUN EFFECTS', STATE.effects);
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
