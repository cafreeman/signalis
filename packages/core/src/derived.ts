import {
  batchCount,
  checkPendingUpdate,
  CLEAN,
  DIRTY,
  getContextIndex,
  getCurrentContext,
  getRunningComputation,
  markDependency,
  markUpdates,
  NOTCLEAN,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { ReactiveFunction, ReactiveValue } from './types.js';
import { assert, reconcileSources } from './utils.js';

const DerivedTag = Symbol('Derived');

// Derived
export class Derived<T> {
  readonly type = DerivedTag;

  private _computeFn: () => T;
  private _lastValue?: T;
  private _status: STATUS = DIRTY;

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
    this.validate();
    return this._lastValue as T;
  }

  validate(): void {
    if (this._sources) {
      const { _sources: sources } = this;
      if (this._status === STALE) {
        // if we're stale, we know that we *might* need to recompute, so we call `validate` on
        // each source until we find one that is dirty. If we end up validating a source as dirty,
        // it'll mark us as dirty as well, so we immediately break and proceed to recomputing.
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
        // even though we might not be marked as stale or dirty yet since the updates will still be
        // buffered inside of the batch transaction. To handle this scenario, we check the pending
        // update map to see if there is already a pending update for one of our sources, and if we
        // find it, we go ahead and run it, which will in turn mark us as dirty if we do, in fact,
        // need to recompute. We don't run a risk of leaking further reactions outside of the
        // transaction here because `markUpdate` will still buffer subsequent updates as long we're
        // still in a batch.
        for (let i = 0; i < sources.length; i++) {
          const update = checkPendingUpdate(sources[i]);

          if (update) {
            update();
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

    reconcileSources(this);

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
      this._status = status;

      if (this._observers) {
        for (let i = 0; i < this._observers.length; i++) {
          this._observers[i]?.markUpdate(STALE);
        }
      }
    }
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
