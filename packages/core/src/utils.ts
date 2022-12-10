import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import type { Signal } from './signal.js';

export function unlinkObservers(target: Derived<unknown> | Reaction) {
  const { sources } = target;
  if (!sources) {
    return;
  }
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i] as Signal<unknown> | Derived<unknown>;
    if (!source.observers) {
      return;
    }
    const idx = source.observers.findIndex((v) => v === target);
    source.observers[idx] = source.observers[source.observers.length - 1] as
      | Derived<unknown>
      | Reaction;
    source.observers.pop();
  }
}
