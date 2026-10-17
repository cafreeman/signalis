import {
  batchCount,
  CLEAN,
  DIRTY,
  getContextIndex,
  getCurrentContext,
  getRunningComputation,
  markDependency,
  markUpdates,
  type NOTCLEAN,
  runPendingUpdate,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { Context, ReactiveFunction, ReactiveValue } from './types.js';
import { assert, hasInvalidatedSource, reconcileSources, unlinkObservers } from './utils.js';

const DerivedTag = Symbol('Derived');

// Derived
//
// A lazy, cached computation. It computes nothing until its `value` is read, and after that it
// recomputes only when it's read while not CLEAN (see "How updates flow through the graph" in
// `state.ts`). It starts out DIRTY with no sources, so the first read runs the computation and
// subscribes the derived to whatever it reads.
export class Derived<T> {
  readonly type = DerivedTag;

  private _computeFn: () => T;
  private _lastValue?: T;
  private _status: STATUS = DIRTY;
  private _isCollecting = false;
  private _hasPendingSources = false;
  private _pendingContext: Context | null = null;
  private _pendingContextIndex = 0;

  /**
   * @internal
   */
  _label: string;
  // logger: (...data: Array<unknown>) => void;

  /**
   * @internal
   */
  _sources: Array<ReactiveValue> | null = null;

  /**
   * @internal
   */
  _observers: Array<ReactiveFunction> | null = null;

  /**
   * The mark owed to this derived's observers by a change inside the current batch, or CLEAN if
   * none (see `markUpdates`).
   *
   * @internal
   */
  _pendingStatus: STATUS = CLEAN;

  constructor(fn: () => T, label?: string) {
    this._computeFn = fn;
    this._label = label ?? '';
    // this.logger = createLogger(label);
  }

  get value(): T {
    markDependency(this);
    this.validate();
    return this._lastValue as T;
  }

  validate(): void {
    if (this._sources) {
      const { _sources: sources } = this;
      if (this._status === STALE) {
        // if we're stale, we know that we *might* need to recompute, so we call `validate` on
        // each source, in the order we read them. A derived source that recomputes to a new value
        // marks us DIRTY, at which point we stop validating and recompute. (Signal sources have
        // nothing to validate: a signal write marks its observers DIRTY directly.)
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          assert(source !== undefined, 'source is undefined');
          source.validate();
          // Have to recast here because `validate` might end up changing the status to something
          // besides STALE
          if ((this._status as STATUS) === DIRTY) {
            break;
          }
        }
      } else if (batchCount() !== 0) {
        // if we're being pulled on inside of a batch, it's possible that we'll need to recompute
        // even though we might not be marked as stale or dirty yet since the marks are still
        // buffered inside of the batch transaction. To handle this scenario, we check whether one
        // of our sources has a buffered mark, and if we find one, we deliver it now
        // (`runPendingUpdate`), which marks us dirty so that we recompute. We don't run a risk of
        // leaking further reactions outside of the transaction here because `markUpdates` keeps
        // buffering the marks of any further changes for as long as we're still in a batch.
        for (let i = 0; i < sources.length; i++) {
          if (runPendingUpdate(sources[i])) {
            break;
          }
        }
      }
    }

    if (this._status === DIRTY) {
      this.compute();
    }

    this._status = CLEAN;
  }

  compute(): void {
    const prevContext = getCurrentContext();
    const prevContextIndex = getContextIndex();
    const prevComputation = getRunningComputation();

    setCurrentContext(null);
    setContextIndex(0);
    setRunningComputation(this);

    const result = this._computeFn();

    if (this._isCollecting) {
      this._pendingContext = getCurrentContext();
      this._pendingContextIndex = getContextIndex();
      this._hasPendingSources = true;
    } else {
      reconcileSources(this);
    }

    setCurrentContext(prevContext);
    setContextIndex(prevContextIndex);
    setRunningComputation(prevComputation);

    if (result !== this._lastValue) {
      markUpdates(this, DIRTY);
      this._lastValue = result;
    }
  }

  markUpdate(status: NOTCLEAN) {
    // CLEAN < STALE < DIRTY
    if (this._status < status) {
      const wasClean = this._status === CLEAN;
      this._status = status;

      // We mark our observers STALE only when we first leave CLEAN. Going from STALE to DIRTY has
      // nothing new to tell them, because they're already STALE and will validate us before they
      // trust their own caches; and if we recompute to a new value, `compute` marks them DIRTY.
      // This keeps each update to a single walk over the downstream edges, which matters most on
      // deep or wide graphs. It relies on the observers of a non-CLEAN derived being non-CLEAN too
      // (see `state.ts`), which `_commitSourceCollection` restores for deferred source collection.
      if (wasClean && this._observers) {
        for (let i = 0; i < this._observers.length; i++) {
          this._observers[i]?.markUpdate(STALE);
        }
      }
    }
  }

  /**
   * @internal
   */
  _beginSourceCollection() {
    this._isCollecting = true;
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
      // because it already left CLEAN before we were its observer. Marking ourselves STALE makes
      // the next read revalidate instead of serving our cached value, and tells our own observers
      if (hasInvalidatedSource(this, this._pendingContextIndex)) {
        this.markUpdate(STALE);
      }
    }
  }

  /**
   * Whether this derived's cached value is known to be current (see `hasInvalidatedSource`).
   *
   * @internal
   */
  _isClean(): boolean {
    return this._status === CLEAN;
  }

  /**
   * Reset this `Derived` to its freshly-constructed state: unlink it from all
   * of its sources, drop its source list, and mark it dirty. A disposed
   * derived isn't dead, though: because it is lazy, the next time its `value`
   * is read, `validate` finds it dirty with no sources and `compute` runs the
   * full first-run path, re-subscribing it to whatever it reads.
   *
   * Note that unlinking *alone* would not be safe. The dirty-marking cascade
   * flows through observer lists, so an unlinked derived would never be
   * marked dirty again; and `reconcileSources` assumes a computation's
   * leading (unchanged) sources are still subscribed, so a recompute would
   * never re-link them. Resetting to the initial state avoids both hazards.
   *
   * Dependents (this derived's own observers) are invalidated so they never
   * serve values cached from a node that no longer tracks upstream changes;
   * their next read revalidates, which transitively resurrects this node.
   */
  dispose() {
    unlinkObservers(this, 0);
    // Invalidate dependents through the batch-aware path: disposal breaks the
    // upstream subscription, so anything they cached from this node is no
    // longer trustworthy. DIRTY is required here because a dependent read
    // inside a batch must recompute immediately when this update is pulled.
    markUpdates(this, DIRTY);
    this._sources = null;
    this._status = DIRTY;
    this._isCollecting = false;
    this._hasPendingSources = false;
  }
}

export function createDerived<T>(fn: () => T, label?: string): Derived<T> {
  return new Derived(fn, label);
}

// function createLogger(label?: string): (...data: Array<unknown>) => void {
//   return (...data: Array<unknown>) => {
//     console.log(label ? `[${label}]` : '', ...data);
//   };
// }

export function isDerived(v: any): v is Derived<unknown> {
  return v.type === DerivedTag;
}
