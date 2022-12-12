import {
  batchCount,
  checkPendingUpdate,
  CLEAN,
  DIRTY,
  getCurrentContext,
  getRunningComputation,
  markDependency,
  markUpdates,
  NOTCLEAN,
  setCurrentContext,
  setRunningComputation,
  STALE,
  type STATUS,
} from './state.js';
import type { ReactiveFunction, ReactiveValue } from './types.js';
import { unlinkObservers } from './utils.js';

// Derived
export class Derived<T> {
  readonly type = 'derived';

  computeFn: () => T;
  lastValue?: T;
  status: STATUS = DIRTY;
  label: string;
  // logger: (...data: Array<unknown>) => void;

  observers: Array<ReactiveFunction> | null = null;
  sources: Array<ReactiveValue> | null = null;

  constructor(fn: () => T, label?: string) {
    this.computeFn = fn;
    this.label = label ?? '';
    // this.logger = createLogger(label);
  }

  get value(): T {
    markDependency(this);
    this.validate();
    return this.lastValue as T;
  }

  validate(): void {
    if (this.sources) {
      const { sources } = this;
      if (this.status === STALE) {
        // if we're stale, we know that we *might* need to recompute, so we call `validate` on
        // each source until we find one that is dirty. If we end up validating a source as dirty,
        // it'll mark us as dirty as well, so we immediately break and proceed to recomputing.
        for (let i = 0; i < sources.length; i++) {
          sources[i]?.validate();
          // Have to recast here because `validate` might end up changing the status to something
          // besides STALE
          if ((this.status as STATUS) === DIRTY) {
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

    if (this.status === DIRTY) {
      this.compute();
    }

    this.status = CLEAN;
  }

  compute(): void {
    const prevContext = getCurrentContext();
    const prevComputation = getRunningComputation();

    const context: Array<ReactiveValue> = [];
    setCurrentContext(context);
    setRunningComputation(this);

    unlinkObservers(this);

    const result = this.computeFn();

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

    if (result !== this.lastValue) {
      markUpdates(this, DIRTY);
      this.lastValue = result;
    }
  }

  markUpdate(status: NOTCLEAN) {
    // CLEAN < STALE < DIRTY
    if (this.status < status) {
      this.status = status;

      if (this.observers) {
        for (let i = 0; i < this.observers.length; i++) {
          this.observers[i]?.markUpdate(STALE);
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

export function isDerived(v: unknown): v is Derived<unknown> {
  return v instanceof Derived;
}
