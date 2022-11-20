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

  get value(): T {
    markDependency(this.#tag);
    return this.#value;
  }

  set value(v: T) {
    if (!this.#isEqual(this.#value, v)) {
      this.#value = v;
      markUpdate(this.#tag);
    }
  }

  // Expressly *not* part of the public API: peeking a value in contexts other than internal parts
  // of the reactivity system itself tends very strongly to produce bugs, because it decouples
  // consumers from the root state. (It is very, very tempting to wire your own caching on with a
  // "peek", rather than using caching tools composed out of the core primitives, or to "be smarter"
  // than the signal system.)
  [Peek](): T {
    return this.#value;
  }
}

export function createSignal(value?: null | undefined): Signal<null>;
export function createSignal<T extends {}>(value: T, isEqual?: Equality<T> | false): Signal<T>;
export function createSignal<T extends {}>(
  value?: T | null | undefined,
  isEqual?: Equality<T> | false
): Signal<T> | Signal<null> {
  if (value == null) {
    return new Signal(null);
  }

  return new Signal(value, isEqual);
}
