import { getMax, Tag } from './tag';
import { GLOBAL_VERSION } from './version';

export class Derived<T> {
  #computeFn: () => T;
  #version: number;
  #prevResult: T;
  #prevTags: Array<Tag>;

  constructor(compute: () => T) {
    this.#computeFn = compute;
    this.#version = GLOBAL_VERSION.value;
    // Access the value immediately so we can cache the result and get reference to all the
    // dependent values
    this.value;
  }

  get value() {
    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      return this.#prevResult;
    }

    let prevCompute = GLOBAL_VERSION.currentComputation;

    GLOBAL_VERSION.currentComputation = new Set();

    try {
      this.#prevResult = this.#computeFn();
    } finally {
      this.#prevTags = Array.from(GLOBAL_VERSION.currentComputation);
      this.#version = getMax(this.#prevTags);

      GLOBAL_VERSION.currentComputation = prevCompute;
    }

    return this.#prevResult;
  }
}

export function createDerived<T>(fn: () => T) {
  return new Derived(fn);
}
