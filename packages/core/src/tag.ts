import {
  addTagToCurrentContext,
  getVersion,
  hasCurrentContext,
  incrementVersion,
  onTagDirtied,
  scheduleReactionsForReactiveValue,
} from './state.js';
import type { ReactiveValue } from './types.js';

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

export type TaggedValue = Tagged & ReactiveValue;

export function markDependency(t: TaggedValue): void {
  addTagToCurrentContext(t);
}

export function markUpdate(t: TaggedValue): void {
  if (hasCurrentContext(t)) {
    throw new Error('Cannot update a tag that has been used during a computation.');
  }

  t[REVISION] = incrementVersion();

  scheduleReactionsForReactiveValue(t);

  onTagDirtied();
}

export function getMax(taggedItems: Iterable<TaggedValue>): Tag {
  // We could also do a `.reduce()`; the key is to make sure we avoid ever running *multiple*
  // passes on the set of tags. Doing multiple `Math.max()` checks should be cheaper, especially in
  // terms of allocation, than doing the extra Array allocations.
  let max = -1;
  for (const tagged of taggedItems) {
    max = Math.max(max, tagged[REVISION]);
  }
  return max as Tag;
}
