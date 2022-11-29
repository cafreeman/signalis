import type { Reaction } from './reaction';
import type { Tag, TaggedValue } from './tag';
import type { DerivedFunction, ReactiveValue } from './types';

export type Context = Set<TaggedValue>;
export type ReactionRegistry = WeakMap<ReactiveValue, Set<Reaction>>;

interface State {
  version: Tag;
  batchCount: number;
  contexts: WeakMap<DerivedFunction, Context>;
  currentContext: Context | null;
  reactionRegistry: ReactionRegistry;
  pendingReactions: Array<Reaction>;
  runningReaction: Reaction | null;
  onTagDirtied: () => void;
}

// SAFETY: this state object is responsible for the global `Tag` count, and so
// consistently casts its `version` as `Tag` internally.
const STATE: State = {
  version: 0 as Tag,

  batchCount: 0,

  contexts: new WeakMap<DerivedFunction, Context>(),
  currentContext: null,

  reactionRegistry: new WeakMap<ReactiveValue, Set<Reaction>>(),
  pendingReactions: [],
  runningReaction: null,

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTagDirtied: () => {},
};

// Tags
export function addTagToCurrentContext(t: TaggedValue) {
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
export function getVersion(): Tag {
  return STATE.version;
}

export function incrementVersion(): Tag {
  return ++STATE.version as Tag;
}

// Context
export function hasCurrentContext(t: TaggedValue): boolean {
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
export function setupCurrentContext(k: DerivedFunction): Context {
  let context = STATE.contexts.get(k);

  if (!context) {
    context = new Set<TaggedValue>();
    STATE.contexts.set(k, context);
  }

  // This is doubly important: we need it to not only make sure we don't carry around wrong lists
  // of dependencies, but also to make sure we avoid leaking the previous dependencies.
  context.clear();
  setCurrentContext(context);
  return context;
}

// Reactions
export function isReactionRunning(): boolean {
  return !!STATE.runningReaction;
}

export function runningReactionHasDeps(): boolean {
  return !!STATE.runningReaction && STATE.runningReaction.hasDeps;
}

export function runningReactionIsInitialized(): boolean {
  return !!STATE.runningReaction && STATE.runningReaction.initialized;
}

export function runningReactionIsFinalized(): boolean {
  return !!STATE.runningReaction && STATE.runningReaction.finalized;
}

export function setRunningReaction(reaction: Reaction | null): void {
  STATE.runningReaction = reaction;
}

// Batching
export function batchStart(): void {
  STATE.batchCount++;
}

export function inBatch(): boolean {
  return STATE.batchCount > 0;
}

export function batchEnd(): void {
  STATE.batchCount--;
  if (STATE.batchCount === 0) {
    runPendingReactions();
  }
}

export function batchCount(): number {
  return STATE.batchCount;
}

// Reaction Registry
export function registerDependencyForReaction(dep: ReactiveValue, reaction: Reaction) {
  const entry = STATE.reactionRegistry.get(dep);

  if (entry) {
    entry.add(reaction);
  } else {
    STATE.reactionRegistry.set(dep, new Set([reaction]));
  }
}

export function scheduleReactionsForReactiveValue(dep: ReactiveValue) {
  const entry = STATE.reactionRegistry.get(dep);

  if (entry) {
    batchStart();
    entry.forEach((reaction) => {
      if (reaction.isDisposed) {
        entry.delete(reaction);
      } else {
        reaction.schedule();
      }
    });
    batchEnd();
  }
}

export function scheduleReaction(r: Reaction) {
  STATE.pendingReactions.push(r);
}

export function runPendingReactions() {
  while (STATE.pendingReactions.length > 0) {
    const reaction = STATE.pendingReactions.shift();
    reaction?.compute();
  }
}
