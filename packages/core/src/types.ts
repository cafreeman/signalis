import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import type { Signal } from './signal.js';

export type ReactiveValue<T = unknown> = Signal<T> | Derived<T>;
export type ReactiveFunction<T = unknown> = Derived<T> | Reaction;

export type Context = Array<ReactiveValue>;
