import {
  addTagToCurrentContext,
  batchCount,
  getVersion,
  hasCurrentContext,
  incrementVersion,
  isEffectRunning,
  onTagDirtied,
  runEffects,
} from './state';

const REVISION = Symbol('Revision');

export type Tag = {
  [REVISION]: number;
};

export function createTag(): Tag {
  return {
    [REVISION]: getVersion(),
  };
}

export function markDependency(t: Tag): void {
  addTagToCurrentContext(t);
}

export function markUpdate(t: Tag): void {
  if (hasCurrentContext(t)) {
    throw new Error('Cannot update a tag that has been used during a computation.');
  }

  t[REVISION] = incrementVersion();

  // If we run effects on *every* update, then we'll end up executing them > 1 times for every
  // derived value that an effect depends on, since the effect will trigger a recompute of the
  // derived value. Instead, we let the full pass over the effects happen once and only once.
  if (!isEffectRunning()) {
    if (batchCount() === 0) {
      runEffects();
    }
  }

  onTagDirtied();
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
