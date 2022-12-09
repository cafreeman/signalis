import type { Derived } from './derived.js';
import type { Signal } from './signal.js';
import {
  type STATUS,
  DIRTY,
  STALE,
  CLEAN,
  setupCurrentContext,
  getCurrentContext,
  getRunningComputation,
  setCurrentContext,
  setRunningComputation,
} from './state.js';
import { validate } from './utils.js';

export class Reaction {
  readonly type = 'reaction';

  sources: Set<Signal<unknown> | Derived<unknown>> | null = null;
  observers = null;
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

    try {
      trapFn();
    } finally {
      this.sources = context;
      setCurrentContext(prevContext);
      setRunningComputation(prevComputation);
    }
  }

  validate() {
    if (this.isDisposed) {
      return;
    }
    if (this.status === STALE) {
      if (this.sources) {
        for (const source of this.sources) {
          validate(source);
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
