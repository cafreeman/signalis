import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import type { Signal } from './signal.js';

export function unlinkObservers(target: Derived<unknown> | Reaction) {
  const { _sources: sources } = target;
  if (!sources) {
    return;
  }
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i] as Signal<unknown> | Derived<unknown>;
    if (!source._observers || source._observers.length === 0) {
      return;
    }
    spliceWhenKnown(source._observers, target);
  }
}

function spliceWhenKnown<T>(array: Array<T>, target: T): Array<T> {
  const idx = array.findIndex((v) => v === target);
  assert(idx !== -1, 'item must be in the array');
  // Since `assert` gets stripped in prod builds, we want to still handle the case where we don't
  // find a match. If we don't return early here, we end up setting the target on the index `-1`
  // and then calling `pop`, which leaves us with an array of length 0...with a `-1` property
  // containing the observer :sob:
  if (idx === -1) {
    return array;
  }

  const last = array[array.length - 1];
  assert(!!last); // array cannot be empty *and* idx not be set!

  array[idx] = last;
  array.pop();

  return array;
}

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}
