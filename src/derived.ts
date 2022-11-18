import { markDependency, markUpdate, getMax, Tag } from './tag';
import { MANAGER } from './manager';
import { Signal } from './signal';

export class Derived<T = unknown> extends Signal {
  #computeFn: () => T;
  #version: number;
  #prevResult: T;
  #prevTags: Array<Tag>;

  constructor(compute: () => T) {
    super(null);
    this.#computeFn = compute;
    this.#version = MANAGER.version;

    // Access the value immediately so we can cache the result and get reference to all the
    // dependent values
    this.value;
  }

  get value() {
    // No matter what, we call `markDependency` immediately so that this derived value gets
    // identified as a dependency of whoever accessed it no matter what
    markDependency(this.tag);

    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      return this.#prevResult;
    }

    let prevCompute = MANAGER.currentCompute;

    MANAGER.currentCompute = new Set();

    // Since we want to memoize downstream updates, we only mark an update here if the value
    // actually changes, rather than simply whenever this Derived's dependencies update. This way,
    // the dependencies can change all they want, but we won't cascade changes unless the
    // computed result itself changes.
    let shouldMarkUpdate = false;

    try {
      let result = this.#computeFn();
      if (!this.isEqual(this.#prevResult, result)) {
        shouldMarkUpdate = true;
      }
      this.#prevResult = result;
    } finally {
      this.#prevTags = Array.from(MANAGER.currentCompute);
      this.#version = getMax(this.#prevTags);

      if (shouldMarkUpdate) {
        markUpdate(this.tag);
      }

      MANAGER.currentCompute = prevCompute;
    }

    return this.#prevResult;
  }

  set value(v: T) {
    throw new Error('derived values are readonly');
  }
}

export function createDerived<T>(fn: () => T) {
  return new Derived(fn);
}
