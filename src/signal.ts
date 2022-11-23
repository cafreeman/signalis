import { createTag, markDependency, markUpdate, type Tag } from './tag';

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

export class Signal<T> {
  private _value: T;
  private _isEqual: Equality<T>;
  private _tag: Tag;

  constructor(value: T, isEqual: Equality<T> | false = baseEquality) {
    this._value = value;

    if (isEqual === false) {
      this._isEqual = neverEqual;
    } else {
      this._isEqual = isEqual;
    }
    this._tag = createTag();
  }

  get value(): T {
    markDependency(this._tag);
    return this._value;
  }

  set value(v: T) {
    if (!this._isEqual(this._value, v)) {
      this._value = v;
      markUpdate(this._tag);
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

export function createSignal(): Signal<unknown>;
export function createSignal<T>(value: T, isEqual?: Equality<T> | false): Signal<T>;
export function createSignal<T extends {}>(
  value?: T,
  isEqual?: Equality<T> | false
): Signal<T> | Signal<unknown> {
  if (arguments.length === 0) {
    return new Signal(null as unknown, false);
  } else {
    // SAFETY: TS doesn't understand that the `arguments` check means there is
    // always *something* passed as `value` here, and therefore that it is safe
    // to treat `value` as indicating what `T` must be.
    return new Signal(value as T, isEqual);
  }
}
