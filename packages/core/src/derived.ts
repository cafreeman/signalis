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
  runReactions,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { Context, ReactiveFunction, ReactiveValue } from './types.js';
import { assert, hasInvalidatedSource, reconcileSources, unlinkObservers } from './utils.js';

const DerivedTag = Symbol('Derived');

// The explicit stack that `Derived._markObserversStale` walks the graph with: for each level of the
// walk below the starting node, the observer array being walked and the index of the next observer
// to visit in it. The arrays are shared by every walk and grow only to the deepest graph marked so
// far. A walk starts at depth 0 and overwrites whatever an earlier walk left in the slots, so none
// of them needs resetting; the observer slots are cleared as frames are popped so the stack doesn't
// keep nodes alive. Sharing them is safe because a walk can't re-enter itself: marking only changes
// statuses and schedules reactions (`Reaction#markUpdate`), and runs no user code.
const stackObservers: Array<Array<ReactiveFunction> | undefined> = [];
const stackIndices: Array<number> = [];

// Stands in for the cached error of a disposed derived, so nothing matches it
const DISPOSED = Symbol('disposed');

function isThenable(v: unknown): v is PromiseLike<unknown> {
  return (
    v !== null &&
    (typeof v === 'object' || typeof v === 'function') &&
    typeof (v as { then?: unknown }).then === 'function'
  );
}

// Derived
//
// A lazy, cached computation. It computes nothing until its `value` is read, and after that it
// recomputes only when it's read while not CLEAN (see "How updates flow through the graph" in
// `state.ts`). It starts out DIRTY with no sources, so the first read runs the computation and
// subscribes the derived to whatever it reads.
//
// If the function throws, the derived treats the error as its result: it settles CLEAN with the
// error cached, notifies its observers like any other change, and rethrows the error on every read
// until a source it read changes. It keeps the sources it read before the throw. Settling CLEAN
// matters: a derived left DIRTY would never notify its observers again, because it only does so
// when it first leaves CLEAN.
export class Derived<T> {
  readonly type = DerivedTag;

  private _computeFn: () => T;
  private _lastValue?: T;
  // The error the function threw on its last run, if it threw (`_hasError` says whether). Kept
  // apart from `_lastValue` so that a throw doesn't discard the value, and so a thrown `undefined`
  // is still an error
  private _error: unknown = undefined;
  private _hasError = false;
  // The thenable we last attached `invalidate` callbacks to, so each one gets them only once
  private _watched: PromiseLike<unknown> | undefined = undefined;
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

  constructor(fn: () => T, label?: string) {
    this._computeFn = fn;
    this._label = label ?? '';
    // this.logger = createLogger(label);
  }

  get value(): T {
    markDependency(this);
    // `validate` does nothing for a CLEAN derived, so the common read skips the call. The condition
    // is small enough for V8 to inline into the caller, which `validate` isn't
    if (this._status !== CLEAN) {
      this.validate();
    }
    if (this._hasError) {
      throw this._error;
    }
    return this._lastValue as T;
  }

  validate(): void {
    if (this._status === STALE && this._sources) {
      // if we're stale, we know that we *might* need to recompute, so we call `validate` on each
      // source, in the order we read them. A derived source that recomputes to a new value marks us
      // DIRTY, at which point we stop validating and recompute. (Signal sources have nothing to
      // validate: a signal write marks its observers DIRTY directly.)
      const { _sources: sources } = this;
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

    let result: T | undefined;
    let error: unknown;
    let threw = false;

    try {
      try {
        result = this._computeFn();
      } catch (e) {
        threw = true;
        error = e;
      }

      // Record the sources read before a throw too, using this derived's own frame, so it
      // recomputes when any of them changes
      if (this._isCollecting) {
        this._pendingContext = getCurrentContext();
        this._pendingContextIndex = getContextIndex();
        this._hasPendingSources = true;
      } else {
        reconcileSources(this);
      }
    } finally {
      setCurrentContext(prevContext);
      setContextIndex(prevContextIndex);
      setRunningComputation(prevComputation);
    }

    if (threw) {
      // A different error, or an error where there was a value, is a change
      const changed = !this._hasError || this._error !== error;
      this._hasError = true;
      this._error = error;

      if (changed) {
        markUpdates(this, DIRTY);
      }

      if (isThenable(error)) {
        this._watch(error);
      }
    } else {
      // A value where there was an error is a change, even if it equals the last value
      const changed = this._hasError || result !== this._lastValue;
      this._hasError = false;
      this._error = undefined;
      this._lastValue = result as T;

      if (changed) {
        markUpdates(this, DIRTY);
      }
    }
  }

  // A derived that throws a promise (a Suspense-style "not ready yet") has to recompute once the
  // promise settles, even though no source changed. This is the one place a derived causes effects
  // to run, and it does so from the promise's callback, never from a read. It has to attach its
  // callbacks here, while computing: that happens before the throw reaches a framework that
  // retries on the same promise, so `invalidate` runs first and the retry finds the derived DIRTY.
  private _watch(thenable: PromiseLike<unknown>): void {
    if (this._watched === thenable) {
      return;
    }
    this._watched = thenable;

    const invalidate = () => {
      // `dispose` clears the error, so this also covers a derived that was disposed in the meantime
      if (!this._hasError || this._error !== thenable) {
        return;
      }
      this.markUpdate(DIRTY);

      if (batchCount() === 0) {
        runReactions();
      }
    };

    thenable.then(invalidate, invalidate);
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
        Derived._markObserversStale(this._observers);
      }
    }
  }

  // Mark everything downstream of a derived that just left CLEAN as STALE, walking the graph with
  // a loop over `stackObservers`/`stackIndices` instead of recursing through `markUpdate`.
  //
  // The visit order matters. Reactions are scheduled as the walk reaches them, and `runReactions`
  // drains that queue last-in-first-out, so the order here sets the order effects run in. The walk
  // is depth first and pre-order: a derived observer is marked and its own observers are walked
  // before the walk moves on to its next sibling. Walking all siblings first would schedule the
  // same reactions in a different order.
  //
  // Derived and reaction observers are handled differently. A derived observer that isn't CLEAN is
  // skipped, because it has already told its own observers (see `markUpdate`). Anything else is a
  // reaction, which has no observers: `markUpdate` just raises its status and schedules it.
  // Observer arrays only grow by `push` and shrink by swap-and-pop, so they have no holes to guard
  // against.
  private static _markObserversStale(root: Array<ReactiveFunction>): void {
    let depth = 0;
    let observers = root;
    let index = 0;

    while (true) {
      if (index < observers.length) {
        const observer = observers[index++]!;

        if (observer instanceof Derived) {
          if (observer._status === CLEAN) {
            observer._status = STALE;

            const downstream = observer._observers;
            if (downstream !== null && downstream.length > 0) {
              stackObservers[depth] = observers;
              stackIndices[depth] = index;
              depth++;
              observers = downstream;
              index = 0;
            }
          }
        } else {
          observer.markUpdate(STALE);
        }
      } else if (depth > 0) {
        depth--;
        observers = stackObservers[depth]!;
        index = stackIndices[depth]!;
        stackObservers[depth] = undefined;
      } else {
        return;
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
    // Invalidate dependents: disposal breaks the upstream subscription, so anything they cached
    // from this node can no longer be trusted. STALE is enough: they revalidate, which recomputes
    // this node and resubscribes it, and they only run again if its value actually changed.
    // Reactions are scheduled but deliberately not run here, because the owner that disposes a
    // derived often disposes the effects that read it right afterwards (a component unmounting),
    // and running them in between would fire them for nothing, an API call included
    markUpdates(this, STALE);
    this._sources = null;
    this._status = DIRTY;
    // Drop the cached error but not the fact that observers last saw one: if this derived recovers
    // to the value it had before it threw, that still has to count as a change for them
    if (this._hasError) {
      this._error = DISPOSED;
    }
    this._watched = undefined;
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
