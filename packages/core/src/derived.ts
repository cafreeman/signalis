import {
  addTagToCurrentContext,
  getCurrentContext,
  getVersion,
  runningReactionIsInitialized,
  setCurrentContext,
  setupCurrentContext,
} from './state.js';
import {
  createTag,
  getMax,
  markDependency,
  markUpdate,
  REVISION,
  Tagged,
  TaggedValue,
} from './tag.js';

class Derived<T> implements Tagged {
  private computeFn: () => T;
  private version = getVersion();
  private prevResult?: T;
  private prevTags?: Array<TaggedValue>;

  [REVISION] = createTag();

  constructor(compute: () => T) {
    this.computeFn = compute;

    // Access the value immediately so we can cache the result and get reference to all the
    // dependent values
    this.value;
  }

  get value(): T {
    // We call `markDependency` immediately so that this derived value gets
    // identified as a dependency of whoever accessed it no matter what
    markDependency(this);

    const prevContext = getCurrentContext();

    if (this.prevTags && getMax(this.prevTags) === this.version) {
      // Even if this derived value doesn't need to recompute, we want to make sure that its
      // dependencies are added to the current compute context so that downstream dependents
      // can tell when to recompute
      if (prevContext && this.prevTags.length > 0) {
        if (!runningReactionIsInitialized()) {
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
