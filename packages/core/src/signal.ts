import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import { markDependency, markUpdate, DIRTY, runReactions } from './state.js';

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

function neverEqual(): boolean {
  return false;
}

// Signal
export class _Signal<T> {
  _value: T;
  _isEqual: Equality<T>;
  observers: Set<Derived<unknown> | Reaction> | null = null;

  constructor(value: T, isEqual: Equality<T> | false = baseEquality) {
    this._value = value;

    if (isEqual === false) {
      this._isEqual = neverEqual;
    } else {
      this._isEqual = isEqual;
    }
  }

  get value() {
    markDependency(this);
    return this._value;
  }

  set value(newValue: T) {
    if (!this._isEqual(this._value, newValue)) {
      this._value = newValue;
      markUpdate(this, DIRTY);
      runReactions();
    }
  }
}

// export function createSignal<T>(value: T): Signal<T> {
//   return new Signal(value);
// }
// Define the public interface to Signal to expressly exclude `_isEqual`: forbidding other types
// from (even implicitly) depending on it very much simplifies the types throughout the rest of the
// system, because it eliminates a variance hazard. Additionally, doing this with `export interface`
// extending the underlying type makes it impossible for external callers to construct this
// directly, whether with the actual `new` operator *or* by trying to define an implementation of
// `Signal` matching the interface (since it has private fields).
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Signal<T> extends Omit<_Signal<T>, '_isEqual'> {}

export function createSignal(): Signal<unknown>;
export function createSignal<T>(value: T, isEqual?: Equality<T> | false): Signal<T>;
export function createSignal<T extends {}>(
  value?: T,
  isEqual?: Equality<T> | false
): Signal<T> | Signal<unknown> {
  if (arguments.length === 0) {
    return new _Signal(null as unknown, neverEqual);
  } else {
    // SAFETY: TS doesn't understand that the `arguments` check means there is
    // always *something* passed as `value` here, and therefore that it is safe
    // to treat `value` as indicating what `T` must be.
    return new _Signal(value as T, isEqual);
  }
}
