import {
  batchCount,
  CLEAN,
  DIRTY,
  getContextIndex,
  getCurrentContext,
  getRunningComputation,
  type NOTCLEAN,
  runReactions,
  scheduleReaction,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { Context, ReactiveValue } from './types.js';
import { hasInvalidatedSource, reconcileSources, unlinkObservers } from './utils.js';

const ReactionTag = Symbol('Reaction');

// Reaction
//
// A side effect at the leaves of the graph. Its sources are whatever is read inside `trap` (or,
// for `createEffect`, inside the effect callback, which runs in a `trap`). When a source changes,
// the reaction is marked and scheduled, and `runReactions` validates it: if a source really did
// change, `compute` runs the reaction's function (see "How updates flow through the graph" in
// `state.ts`).
export class Reaction {
  readonly type = ReactionTag;
  private _initialized = false;
  /**
   * @internal
   */
  _sources: Array<ReactiveValue> | null = null;

  private _fn: () => void | (() => void);

  private _cleanupFn?: () => void;
  private _isCollecting = false;
  private _hasPendingSources = false;
  private _pendingContext: Context | null = null;
  private _pendingContextIndex = 0;

  /**
   * @internal
   */
  status: STATUS = CLEAN;

  isDisposed = false;

  /**
   * Whether this reaction is waiting in the queue that `runReactions` drains (see
   * `scheduleReaction`).
   *
   * @internal
   */
  _isScheduled = false;

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

      if (this._isCollecting) {
        this._pendingContext = getCurrentContext();
        this._pendingContextIndex = getContextIndex();
        this._hasPendingSources = true;
      } else {
        reconcileSources(this);
      }

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
    // CLEAN < STALE < DIRTY. Reactions have no observers, so marking one just raises its status and
    // queues it for `runReactions`, which validates it: a STALE reaction checks its sources and
    // runs only if one of them actually changed, and a DIRTY one runs unconditionally.
    if (this.status < status) {
      scheduleReaction(this);

      this.status = status;
    }
  }

  /**
   * @internal
   */
  _beginSourceCollection() {
    this._isCollecting = true;
    this._hasPendingSources = false;
  }

  /**
   * @internal
   */
  _commitSourceCollection() {
    if (!this._isCollecting) {
      return;
    }

    this._isCollecting = false;

    if (this._hasPendingSources) {
      reconcileSources(this, this._pendingContext, this._pendingContextIndex);
      this._hasPendingSources = false;

      // A source we just linked may have been invalidated since we read it, and it won't tell us,
      // because it already left CLEAN before we were its observer. Marking ourselves STALE queues
      // us to check our sources and run if one of them changed. Nothing else is going to drain the
      // queue until the next write, so we run it now, unless a batch will run it when it ends
      if (hasInvalidatedSource(this, this._pendingContextIndex)) {
        this.markUpdate(STALE);

        if (batchCount() === 0) {
          runReactions();
        }
      }
    }
  }

  /**
   * @internal
   */
  dispose() {
    // Pass 0 as the start index so we unlink from *all* of our sources, no
    // matter what computation (if any) is running when dispose is called
    unlinkObservers(this, 0);
    this.isDisposed = true;
    this._isCollecting = false;
    this._hasPendingSources = false;
    if (this._cleanupFn) {
      this._cleanupFn();
    }
  }
}

export function isReaction(v: any): v is Reaction {
  return v.type === ReactionTag;
}
