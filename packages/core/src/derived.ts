import { markDependency, markUpdate, getMax, createTag, REVISION, Tagged } from './tag';
import {
  addTagToCurrentContext,
  setupCurrentContext,
  getCurrentContext,
  getVersion,
  isEffectRunning,
  runningEffectHasDeps,
  setCurrentContext,
} from './state';

class Derived<T> implements Tagged {
  private computeFn: () => T;
  private version = getVersion();
  private prevResult?: T;
  private prevTags?: Array<Tagged>;

  [REVISION] = createTag();

  constructor(compute: () => T) {
    this.computeFn = compute;

    // Access the value immediately so we can cache the result and get reference to all the
    // dependent values
    this.value;
  }

  get value(): T {
    // No matter what, we call `markDependency` immediately so that this derived value gets
    // identified as a dependency of whoever accessed it no matter what
    markDependency(this);

    const prevContext = getCurrentContext();

    if (this.prevTags && getMax(this.prevTags) === this.version) {
      // Even if this derived value doesn't need to recompute, we want to make sure that its
      // dependencies are added to the current compute context so that downstream dependents
      // can tell when to recompute
      if (prevContext && this.prevTags.length > 0) {
        if (!runningEffectHasDeps()) {
          this.prevTags.forEach((tag) => {
            addTagToCurrentContext(tag);
          });
        }
      }

      // SAFETY: we know by having checked for `#prevTags` and the current version that this
      // will be set. TODO: can we encode that into the type so that we *know* it's the case
      // simply by having checked? Should be able to!
      return this.prevResult as T;
    }

    const currentContext = setupCurrentContext(this);

    // Since we want to memoize downstream updates, we only mark an update here if the value
    // actually changes, rather than simply whenever this Derived's dependencies update. This way,
    // the dependencies can change all they want, but we won't cascade changes unless the
    // computed result itself changes.
    let shouldMarkUpdate = false;

    try {
      const result = this.computeFn();

      // For now, we hard code this as `===` equality, and if we later introduce the ability for
      // users to get the previous value as part of the computation, *that* would be where they
      // can do custom equality handling, rather than needing a comparison function like `Signal`.
      if (this.prevResult !== result) {
        shouldMarkUpdate = true;
      }
      this.prevResult = result;
    } finally {
      this.prevTags = Array.from(currentContext);
      this.version = getMax(this.prevTags);

      // Since effects are never accessed directly (like signals and derived values), it's impossible
      // to know when an effect that depends on a derived value needs to be recomputed, since we
      // won't know whether the derived value has changed until we access its value. The most basic
      // solution here is to simply always run every effect, but that would be probitively expensive
      // from a performance standpoint. Instead, whenever a derived value recomputes AND we know
      // we're in the middle of an effect computation, we add that derived value's dependencies as
      // direct dependencies on the effect. That way the effect will know to recompute even if
      // the derived value itself hasn't been re-run and marked as updated
      if (isEffectRunning() && prevContext) {
        // If the effect has specified its own dependencies, then we want to skip this so we don't
        // add extra dependencies to the effect
        if (!runningEffectHasDeps()) {
          currentContext.forEach((c) => {
            // We definitely know prevCompute is defined already but TS does not agree since we're
            // in a callback here, so adding the extra assertion just to be thorough
            prevContext && prevContext.add(c);
          });
        }
      }

      if (shouldMarkUpdate) {
        markUpdate(this);
      }

      setCurrentContext(prevContext);
    }

    return this.prevResult;
  }

  set value(_v: T) {
    throw new Error('derived values are readonly');
  }
}

export type { Derived };

export function createDerived<T>(fn: () => T) {
  return new Derived(fn);
}
