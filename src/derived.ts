import { getMax, Tag } from './tag';
import { MANAGER } from './manager';

export class Derived<T> {
  #computeFn: () => T;
  #version: number;
  #prevResult: T;
  #prevTags: Array<Tag>;

  constructor(compute: () => T) {
    this.#computeFn = compute;
    this.#version = MANAGER.version;
    // Access the value immediately so we can cache the result and get reference to all the
    // dependent values
    this.value;
  }

  get value() {
    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      return this.#prevResult;
    }

    let prevCompute = MANAGER.currentCompute;

    MANAGER.currentCompute = new Set();

    try {
      this.#prevResult = this.#computeFn();
    } finally {
      this.#prevTags = Array.from(MANAGER.currentCompute);
      this.#version = getMax(this.#prevTags);

      MANAGER.currentCompute = prevCompute;
    }

    return this.#prevResult;
  }
}

export function createDerived<T>(fn: () => T) {
  return new Derived(fn);
}
