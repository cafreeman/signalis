import {
  CLEAN,
  DIRTY,
  getCurrentContext,
  getRunningComputation,
  NOTCLEAN,
  scheduleReaction,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { ReactiveFunction, ReactiveValue } from './types.js';
import { unlinkObservers } from './utils.js';

export class Reaction {
  readonly type = 'reaction';
  sources: Array<ReactiveValue> | null = null;
  observers: Array<ReactiveFunction> | null = null;
  fn: () => void;
  cleanupFn?: () => void;
  status: STATUS = CLEAN;
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

    const context: Array<ReactiveValue> = [];
    setCurrentContext(context);
    setRunningComputation(this);

    unlinkObservers(this);

    try {
      trapFn();
    } finally {
      this.sources = context;

      for (let i = 0; i < this.sources.length; i++) {
        const source = this.sources[i];
        if (source) {
          if (source.observers) {
            source.observers.push(this);
          } else {
            source.observers = [this];
          }
        }
      }

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

    const context: Array<ReactiveValue> = [];
    setCurrentContext(context);
    setRunningComputation(this);

    this.fn();

    setCurrentContext(prevContext);
    setRunningComputation(prevComputation);
  }

  markUpdate(status: NOTCLEAN) {
    // CLEAN < STALE < DIRTY
    if (this.status < status) {
      scheduleReaction(this);

      this.status = status;
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.cleanupFn) {
      this.cleanupFn();
    }
  }
}

export function isReaction(v: ReactiveFunction): v is Reaction {
  return v.type === 'reaction';
}
