import type { Derived } from './derived';
import type { Effect } from './effect';
import type { Reaction } from './reaction';
import type { Signal } from './signal';

export type ReactiveValue<T = unknown> = Signal<T> | Derived<T>;
export type DerivedFunction = Derived<unknown> | Effect | Reaction;
