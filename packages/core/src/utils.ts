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
    if (!source._observers) {
      return;
    }
    spliceWhenKnown(source._observers, target);
  }
}

function spliceWhenKnown<T>(array: Array<T>, target: T): Array<T> {
  const idx = array.findIndex((v) => v === target);
  assert(idx !== -1, 'item must be in the array');

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
