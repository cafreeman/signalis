import { isEffectRunning } from './state';
import { createTag, markDependency, markUpdate, REVISION, type Tagged } from './tag';

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

function neverEqual(): boolean {
  return false;
}

/**
  @private This is available for internal "friend" APIs to use, but it is *not*
    legal to use by consumers.
 */
export const Peek = Symbol('Peek');

class _Signal<T> implements Tagged {
  private _value: T;
  private _isEqual: Equality<T>;

  [REVISION] = createTag();

  constructor(value: T, isEqual: Equality<T> | false = baseEquality) {
    this._value = value;

    if (isEqual === false) {
      this._isEqual = neverEqual;
    } else {
      this._isEqual = isEqual;
    }
  }

  get value(): T {
    markDependency(this);
    return this._value;
  }

  set value(v: T) {
    if (!this._isEqual(this._value, v)) {
      this._value = v;
      console.log('mark signal update');
      console.log('is effect running during signal update', isEffectRunning());
      markUpdate(this);
    }
  }

  // Expressly *not* part of the public API: peeking a value in contexts other than internal parts
  // of the reactivity system itself tends very strongly to produce bugs, because it decouples
  // consumers from the root state. (It is very, very tempting to wire your own caching on with a
  // "peek", rather than using caching tools composed out of the core primitives, or to "be smarter"
  // than the signal system.)
  [Peek](): T {
    return this._value;
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
export function createSignal<T extends {}>(
  value?: T,
  isEqual?: Equality<T> | false
): Signal<T> | Signal<unknown> {
  console.log('CREATE SIGNAL');
  if (arguments.length === 0) {
    return new _Signal(null as unknown, false);
  } else {
    // SAFETY: TS doesn't understand that the `arguments` check means there is
    // always *something* passed as `value` here, and therefore that it is safe
    // to treat `value` as indicating what `T` must be.
    return new _Signal(value as T, isEqual);
  }
}

export function isSignal(s: _Signal<unknown> | unknown) {
  return s instanceof _Signal;
}
