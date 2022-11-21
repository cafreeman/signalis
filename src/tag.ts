import { MANAGER } from './manager';

const REVISION = Symbol('Revision');

export type Tag = {
  [REVISION]: number;
};

export function createTag(): Tag {
  return {
    [REVISION]: MANAGER.version,
  };
}

export function markDependency(t: Tag): void {
  if (MANAGER.currentContext) {
    MANAGER.currentContext.add(t);
  }
}

export function markUpdate(t: Tag): void {
  if (MANAGER.currentContext?.has(t)) {
    throw new Error('Cannot update a tag that has been used during a computation.');
  }

  t[REVISION] = MANAGER.incrementVersion();

  // If we run effects on *every* update, then we'll end up executing them > 1 times for every
  // derived value that an effect depends on, since the effect will trigger a recompute of the
  // derived value. Instead, we let the full pass over the effects happen once and only once.
  if (!MANAGER.isEffectRunning) {
    if (MANAGER.batchCount === 0) {
      MANAGER.runEffects();
    }
  }

  MANAGER.onTagDirtied();
}

export function getMax(tags: Array<Tag>): number {
  // We could also do a `.reduce()`; the key is to make sure we avoid ever running *multiple*
  // passes on the set of tags. Doing multiple `Math.max()` checks should be cheaper, especially in
  // terms of allocation, than doing the extra Array allocations.
  let max = -1;
  for (const tag of tags) {
    max = Math.max(max, tag[REVISION]);
  }
  return max;
}

export function setOnTagDirtied(fn: () => void) {
  MANAGER.onTagDirtied = fn;
}
