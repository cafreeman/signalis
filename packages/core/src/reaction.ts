import {
  CLEAN,
  DIRTY,
  getContextIndex,
  getCurrentContext,
  getRunningComputation,
  type NOTCLEAN,
  scheduleReaction,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { ReactiveValue } from './types.js';
import { reconcileSources, unlinkObservers } from './utils.js';

const ReactionTag = Symbol('Reaction');

export class Reaction {
  readonly type = ReactionTag;
  private _initialized = false;
  /**
   * @internal
   */
  _sources: Array<ReactiveValue> | null = null;

  private _fn: () => void | (() => void);

  private _cleanupFn?: () => void;

  /**
   * @internal
   */
  status: STATUS = CLEAN;

  isDisposed = false;

  constructor(fn: () => void | (() => void), cleanup?: () => void) {
    this._fn = fn;

    if (cleanup) {
      this._cleanupFn = cleanup;
      this._initialized = true;
    }
  }

  trap(trapFn: () => void | (() => void)) {
    if (this.isDisposed) {
      return;
    }
    const prevContext = getCurrentContext();
    const prevContextIndex = getContextIndex();
    const prevComputation = getRunningComputation();

    setCurrentContext(null);
    setContextIndex(0);
    setRunningComputation(this);

    try {
      const cleanupFn = trapFn();

      reconcileSources(this);

      return cleanupFn;
    } finally {
      setCurrentContext(prevContext);
      setContextIndex(prevContextIndex);
      setRunningComputation(prevComputation);
    }
  }

  validate() {
    if (this.isDisposed) {
      return;
    }
    if (this.status === STALE) {
      const { _sources: sources } = this;
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

  compute(): void | (() => void) {
    if (this.isDisposed) {
      return;
    }
    const prevContext = getCurrentContext();
    const prevContextIndex = getContextIndex();
    const prevComputation = getRunningComputation();

    setCurrentContext(null);
    setContextIndex(0);
    setRunningComputation(this);

    try {
      if (this._initialized) {
        this._fn();
      } else {
        // If this is our first compute, we check to see if the callback returns a cleanup function
        // and save it if so, then mark the instance as initialized so we don't check any further
        const cleanupFn = this._fn();
        if (cleanupFn) {
          this._cleanupFn = cleanupFn;
        }
        this._initialized = true;
      }
    } finally {
      setCurrentContext(prevContext);
      setContextIndex(prevContextIndex);
      setRunningComputation(prevComputation);
    }
  }

  /**
   * @internal
   */
  markUpdate(status: NOTCLEAN) {
    // CLEAN < STALE < DIRTY
    if (this.status < status) {
      scheduleReaction(this);

      this.status = status;
    }
  }

  /**
   * @internal
   */
  dispose() {
    unlinkObservers(this);
    this.isDisposed = true;
    if (this._cleanupFn) {
      this._cleanupFn();
    }
  }
}

export function isReaction(v: any): v is Reaction {
  return v.type === ReactionTag;
}
