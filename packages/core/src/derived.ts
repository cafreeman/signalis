import type { Reaction } from './reaction.js';
import type { Signal } from './signal.js';
import {
  type STATUS,
  DIRTY,
  markDependency,
  STALE,
  CLEAN,
  markUpdate,
  setupCurrentContext,
  setRunningComputation,
  getCurrentContext,
  getRunningComputation,
  setCurrentContext,
  checkPendingUpdate,
  batchCount,
} from './state.js';
import { validate } from './utils.js';

// Derived
export class Derived<T> {
  computeFn: () => T;
  lastValue?: T;
  status: STATUS = DIRTY;
  label: string;
  logger: (...data: Array<unknown>) => void;

  observers: Set<Derived<unknown> | Reaction> | null = null;
  sources: Set<Signal<unknown> | Derived<unknown>> | null = null;

  constructor(fn: () => T, label?: string) {
    this.computeFn = fn;
    this.label = label ?? '';
    this.logger = createLogger(label);
  }

  get value(): T {
    markDependency(this);
    this.validate();
    return this.lastValue as T;
  }

  validate(): void {
    if (this.sources) {
      if (this.status === STALE) {
        // if we're stale, we know that we *might* need to recompute, so we call `validate` on
        // each source until we find one that is dirty. If we end up validating a source as dirty,
        // it'll mark us as dirty as well, so we immediately break and proceed to recomputing.
        for (const source of this.sources) {
          validate(source);
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
        for (const source of this.sources) {
          const update = checkPendingUpdate(source);

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
    const context = setupCurrentContext(this);
    setRunningComputation(this);

    const result = this.computeFn();

    this.sources = context;

    setCurrentContext(prevContext);
    setRunningComputation(prevComputation);

    if (result !== this.lastValue) {
      markUpdate(this, DIRTY);
      this.lastValue = result;
    }
  }
}

export function createDerived<T>(fn: () => T, label?: string): Derived<T> {
  return new Derived(fn, label);
}

function createLogger(label?: string): (...data: Array<unknown>) => void {
  return (...data: Array<unknown>) => {
    console.log(label ? `[${label}]` : '', ...data);
  };
}
