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

  validate() {
    if (this.status === STALE) {
      if (this.sources) {
        for (const source of this.sources) {
          validate(source);
          // Have to recast here because `validate` might end up changing the status to something
          // besides STALE
          if ((this.status as STATUS) === DIRTY) {
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

function createLogger(label?: string) {
  return (...data: Array<unknown>) => {
    console.log(label ? `[${label}]` : '', ...data);
  };
}
