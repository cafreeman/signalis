import type { Derived } from './derived';
import type { Signal } from './signal';

export type ReactiveValue<T> = Signal<T> | Derived<T>;
