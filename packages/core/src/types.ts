import type { Derived } from './derived';
import type { Reaction } from './reaction';
import type { Resource, ResourceWithSignal } from './resource';
import type { Signal } from './signal';

export type ReactiveValue<T = unknown> =
  | Signal<T>
  | Derived<T>
  | Resource<T>
  | ResourceWithSignal<T, any>;
export type DerivedFunction = Derived<unknown> | Reaction;
