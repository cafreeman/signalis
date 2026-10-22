import type { Derived } from './derived.js';
import type { Reaction } from './reaction.js';
import { batchCount, DIRTY, markDependency, markUpdates, runReactions } from './state.js';

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

function neverEqual(): boolean {
  return false;
}

const SignalTag = Symbol('Signal');

// Signal
export class _Signal<T> {
  readonly type = SignalTag;
  private _value: T;
  private _isEqual: Equality<T>;

  /**
   * @internal
   */
  _observers: Array<Derived<unknown> | Reaction> | null = null;

  constructor(value: T, isEqual: Equality<T> | false = baseEquality) {
    this._value = value;

    if (isEqual === false) {
      this._isEqual = neverEqual;
    } else {
      this._isEqual = isEqual;
    }
  }

  // A signal always holds its current value, so there's nothing to validate. Computations call this
  // on each of their sources without checking whether the source is a signal or a derived.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  validate() {}

  /**
   * Always true: a signal's value is current by definition (see `hasInvalidatedSource`).
   *
   * @internal
   */
  _isClean(): boolean {
    return true;
  }

  get value() {
    markDependency(this);
    return this._value;
  }

  // A write that changes the value marks every observer DIRTY, then validates whatever reactions
  // are scheduled. Inside a batch the reactions stay scheduled until the outermost batch ends
  // (`batchEnd`), so no effect observes a half-applied set of writes
  set value(newValue: T) {
    if (!this._isEqual(this._value, newValue)) {
      this._value = newValue;
      markUpdates(this, DIRTY);
      if (batchCount() === 0) {
        runReactions();
      }
    }
  }
}

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
export function createSignal<T>(
  value?: T | null | undefined,
  isEqual?: Equality<T> | false,
): Signal<T> | Signal<unknown> {
  if (arguments.length === 0) {
    return new _Signal(null, neverEqual);
  }
  if (value == null) {
    return new _Signal(value);
  } else {
    return new _Signal(value, isEqual);
  }
}

export function isSignal(v: any): v is Signal<unknown> {
  return v.type === SignalTag;
}
