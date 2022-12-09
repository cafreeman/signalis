import type { Derived } from './derived.js';
import type { Signal } from './signal.js';

export function validate(v: Signal<unknown> | Derived<unknown>) {
  if ('validate' in v) {
    v.validate();
  }
}
