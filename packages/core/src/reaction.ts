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

const ReactionTag = Symbol('Reaction');

export class Reaction {
  readonly type = ReactionTag;
  /**
   * @internal
   */
  _sources: Array<ReactiveValue> | null = null;

  /**
   * @internal
   */
  _observers: Array<ReactiveFunction> | null = null;

  private _fn: () => void;

  private _cleanupFn?: () => void;

  /**
   * @internal
   */
  status: STATUS = CLEAN;

  isDisposed = false;

  constructor(fn: () => void, cleanup?: () => void) {
    this._fn = fn;

    if (cleanup) {
      this._cleanupFn = cleanup;
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
      this._sources = context;

      for (let i = 0; i < this._sources.length; i++) {
        const source = this._sources[i];
        if (source) {
          if (source._observers) {
            source._observers.push(this);
          } else {
            source._observers = [this];
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

  compute() {
    if (this.isDisposed) {
      return;
    }
    const prevContext = getCurrentContext();
    const prevComputation = getRunningComputation();

    const context: Array<ReactiveValue> = [];
    setCurrentContext(context);
    setRunningComputation(this);

    this._fn();

    setCurrentContext(prevContext);
    setRunningComputation(prevComputation);
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
