let GLOBAL_VERSION = 0;

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

export class Signal<T> {
  #value: T;
  #isEqual: Equality<T>;

  constructor(value: T, isEqual: Equality<T> = baseEquality) {
    this.#value = value;
    this.#isEqual = isEqual;
  }

  get value() {
    return this.#value;
  }

  set value(v: T) {
    if (!this.#isEqual(this.#value, v)) {
      this.#value = v;
      GLOBAL_VERSION++;
    }
  }
}

export function createSignal<T>(value: T) {
  return new Signal(value);
}

export class Derived<T> {
  #compute: () => T;
  #version: number;
  #prevResult: T;

  constructor(compute: () => T) {
    this.#compute = compute;
    this.#version = GLOBAL_VERSION;
    this.#prevResult = this.#compute();
  }

  get value() {
    if (GLOBAL_VERSION > this.#version) {
      let result = this.#compute();
      this.#prevResult = result;
      return result;
    }

    return this.#prevResult;
  }
}
