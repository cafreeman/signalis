import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import type { Resource, ResourceWithSignal } from './resource.js';
import type { Signal } from './signal.js';

export type ReactiveValue<T = unknown> =
  | Signal<T>
  | Derived<T>
  | Resource<T>
  | ResourceWithSignal<T, any>;
export type DerivedFunction = Derived<unknown> | Reaction;
