// State

class State {
  currentContext: Set<any> | null = null;
  runningComputation: Derived<unknown> | null = null;
}

const STATE = new State();

const CLEAN = Symbol('Clean');
type CLEAN = typeof CLEAN;
const STALE = Symbol('Stale');
type STALE = typeof STALE;
const DIRTY = Symbol('Dirty');
type DIRTY = typeof DIRTY;

type STATUS = CLEAN | STALE | DIRTY;
type NOTCLEAN = Exclude<STATUS, CLEAN>;

function markDependency(v: Signal<unknown> | Derived<unknown>) {
  if (STATE.currentContext) {
    STATE.currentContext.add(v);
  }

  if (STATE.runningComputation) {
    if (v.observers) {
      v.observers.push(STATE.runningComputation);
    } else {
      v.observers = [STATE.runningComputation];
    }
  }
}

function markUpdate(v: Signal<unknown> | Derived<unknown>, state: NOTCLEAN) {
  if (v.observers) {
    v.observers.forEach((observer) => {
      // immediate observers are definitely dirty since we know the source just updated
      observer.status = state;

      if (observer.observers) {
        observer.observers.forEach((child) => {
          // indirect observers (children of children) are at least stale since we know something
          // further up the dependency tree has changed, but they might not actually be dirty
          child.status = STALE;
          markUpdate(child, STALE);
        });
      }
    });
  }
}

// Signal
class Signal<T> {
  _value: T;
  observers: Array<Derived<unknown>> | null = null;

  constructor(value: T) {
    this._value = value;
  }

  get value() {
    markDependency(this);
    return this._value;
  }

  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue;
      markUpdate(this, DIRTY);
    }
  }
}

export function createSignal<T>(value: T): Signal<T> {
  return new Signal(value);
}

function validate(v: Signal<unknown> | Derived<unknown>) {
  if ('validate' in v) {
    v.validate();
  }
}

function createLogger(label?: string) {
  return (...data: Array<any>) => {
    console.log(label ? `[${label}]` : '', ...data);
  };
}

// Derived
class Derived<T> {
  computeFn: () => T;
  lastValue?: T;
  status: STATUS = DIRTY;
  label: string;
  logger: (...data: Array<any>) => void;

  observers: Array<Derived<unknown>> | null = null;
  sources: Array<Signal<unknown> | Derived<unknown>> | null = null;

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
    const prevContext = STATE.currentContext;
    const prevComputation = STATE.runningComputation;

    STATE.currentContext = new Set();
    STATE.runningComputation = this;

    const result = this.computeFn();

    this.sources = Array.from(STATE.currentContext);
    STATE.currentContext = prevContext;
    STATE.runningComputation = prevComputation;

    if (result !== this.lastValue) {
      markUpdate(this, DIRTY);
      this.lastValue = result;
    }
  }
}

export function createDerived<T>(fn: () => T, label?: string): Derived<T> {
  return new Derived(fn, label);
}
