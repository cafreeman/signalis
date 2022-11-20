import { createTag, markDependency, markUpdate, type Tag } from './tag';

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

/**
  @private This is available for internal "friend" APIs to use, but it is *not*
    legal to use by consumers.
 */
export const Peek = Symbol('Peek');

export class Signal<T> {
  #value: T;
  #isEqual: Equality<T>;
  #tag: Tag;

  constructor(value: T, isEqual: Equality<T> | false = baseEquality) {
    this.#value = value;

    if (isEqual === false) {
      this.#isEqual = () => false;
    } else {
      this.#isEqual = isEqual;
    }
    this.#tag = createTag();
  }

  from<A>(value: A, isEqual: Equality<A> | false = baseEquality): Signal<A> {
    return new Signal(value, isEqual);
  }

  get value(): T {
    markDependency(this.#tag);
    return this.#value;
  }

  // Expressly *not* part of the public API: peeking a value in contexts other than internal parts
  // of the reactivity system itself tends very strongly to produce bugs, because it decouples
  // consumers from the root state. (It is very, very tempting to wire your own caching on with a
  // "peek", rather than using caching tools composed out of the core primitives, or to "be smarter"
  // than the signal system.)
  [Peek](): T {
    return this.#value;
  }

  set value(v: T) {
    if (!this.#isEqual(this.#value, v)) {
      this.#value = v;
      markUpdate(this.#tag);
    }
  }
}

export function createSignal<T>(value: T, isEqual?: Equality<T> | false) {
  return new Signal(value, isEqual);
}
