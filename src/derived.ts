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
      // Even if this derived value doesn't need to recompute, we want to make sure that its
      // dependencies are added to the current compute context so that downstream dependents
      // can tell when to recompute
      if (MANAGER.currentCompute && this.#prevTags.length > 0) {
        this.#prevTags.forEach((tag) => {
          MANAGER.currentCompute?.add(tag);
        });
      }
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

      // Since effects are never accessed directly (like signals and derived values), it's impossible
      // to know when an effect that depends on a derived value needs to be recomputed, since we
      // won't know whether the derived value has changed until we access its value. The most basic
      // solution here is to simply always run every effect, but that would be probitively expensive
      // from a performance standpoint. Instead, whenever a derived value recomputes AND we know
      // we're in the middle of an effect computation, we add that derived value's dependencies as
      // direct dependencies on the effect. That way the effect will know to recompute even if
      // the derived value itself hasn't been re-run and marked as updated
      if (MANAGER.isEffectRunning && prevCompute) {
        prevCompute = new Set([...prevCompute, ...MANAGER.currentCompute]);
      }

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
