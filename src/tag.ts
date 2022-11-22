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

// Type-only, zero-cost way of making type-safe "new types".
declare const DataTag: unique symbol;
declare class Opaque<T> {
  private [DataTag]: T;
}

// Applied to numbers for the sake of making this module the only way to get a
// thing used as a `Tag`.
export type Tag = number & Opaque<'tag'>;

export const createTag: () => Tag = getVersion;

// Which in turn we use to define our revision system, by having anything which
// uses a tag supply it directly on the item with this private symbol.
/** @internal */
export const REVISION = Symbol('Revision');

export interface Tagged {
  [REVISION]: Tag;
}

export function markDependency(t: Tagged): void {
  addTagToCurrentContext(t);
}

export function markUpdate(t: Tagged): void {
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

export function getMax(taggedItems: Iterable<Tagged>): Tag {
  // We could also do a `.reduce()`; the key is to make sure we avoid ever running *multiple*
  // passes on the set of tags. Doing multiple `Math.max()` checks should be cheaper, especially in
  // terms of allocation, than doing the extra Array allocations.
  let max = -1;
  for (const tagged of taggedItems) {
    max = Math.max(max, tagged[REVISION]);
  }
  return max as Tag;
}
