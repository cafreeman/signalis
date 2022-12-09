import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import type { Signal } from './signal.js';

export function validate(v: Signal<unknown> | Derived<unknown>): void {
  if ('validate' in v) {
    v.validate();
  }
}

export function unlinkObservers(target: Derived<unknown> | Reaction) {
  if (target.sources) {
    target.sources.forEach((source) => {
      source.observers?.delete(target);
    });
  }
}
