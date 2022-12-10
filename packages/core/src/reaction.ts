import type { Derived } from './derived.js';
import type { Signal } from './signal.js';
import {
  CLEAN,
  DIRTY,
  getCurrentContext,
  getRunningComputation,
  setCurrentContext,
  setRunningComputation,
  setupCurrentContext,
  STALE,
  type STATUS,
} from './state.js';
import { unlinkObservers } from './utils.js';

export class Reaction {
  readonly type = 'reaction';
  sources: Array<Signal<unknown> | Derived<unknown>> | null = null;
  observers: Array<Derived<unknown> | Reaction> | null = null;
  fn: () => void;
  cleanupFn?: () => void;
  status: STATUS = DIRTY;
  isDisposed = false;

  constructor(fn: () => void, cleanup?: () => void) {
    this.fn = fn;

    if (cleanup) {
      this.cleanupFn = cleanup;
    }
  }

  trap(trapFn: () => void) {
    if (this.isDisposed) {
      return;
    }
    const prevContext = getCurrentContext();
    const prevComputation = getRunningComputation();

    const context = setupCurrentContext(this);
    setRunningComputation(this);

    unlinkObservers(this);

    try {
      trapFn();
    } finally {
      this.sources = Array.from(context);
      setCurrentContext(prevContext);
      setRunningComputation(prevComputation);
    }
  }

  validate() {
    if (this.isDisposed) {
      return;
    }
    if (this.status === STALE) {
      const { sources } = this;
      if (sources) {
        for (let i = 0; i < sources.length; i++) {
          sources[i]?.validate();
          // Have to recast here because `validate` might end up changing the status to something
          // besides STALE
          if ((this.status as STATUS) === DIRTY) {
            // As soon as we find a single DIRTY source, we know that we need to re-compute, so we
            // immediately bail
            break;
          }
        }
      }
    }

    if (this.status === DIRTY) {
      this.compute();
    }

    this.status = CLEAN;
  }

  compute() {
    if (this.isDisposed) {
      return;
    }
    const prevContext = getCurrentContext();
    const prevComputation = getRunningComputation();

    setupCurrentContext(this);
    setRunningComputation(this);

    this.fn();

    setCurrentContext(prevContext);
    setRunningComputation(prevComputation);
  }

  dispose() {
    this.isDisposed = true;
    if (this.cleanupFn) {
      this.cleanupFn();
    }
  }
}

export function isReaction(v: Derived<unknown> | Reaction): v is Reaction {
  return v.type === 'reaction';
}
