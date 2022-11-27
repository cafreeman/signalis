import type { ComputeFn } from './effect';
import {
  batchEnd,
  batchStart,
  getCurrentContext,
  getVersion,
  registerDependencyForReaction,
  scheduleReaction,
  setCurrentContext,
  setRunningReaction,
  setupCurrentContext,
} from './state';
import { getMax } from './tag';
import type { ReactiveValue } from './types';

export class Reaction {
  private _computeFn: ComputeFn;
  private _cleanupFn?: (() => void) | undefined;
  private _deps?: Array<ReactiveValue>;
  private _version: number = getVersion();
  private _initialized = false;
  private _finalized = false;
  isDisposed = false;

  constructor(fn: ComputeFn, dispose?: () => void) {
    this._computeFn = fn;
    this._cleanupFn = dispose;
    this.compute();
    this._initialized = true;
  }

  get initialized() {
    return this._initialized;
  }

  get finalized() {
    return this._finalized;
  }

  get hasDeps() {
    return !!this._deps && this._deps.length > 0;
  }

  _computeDeps() {
    if (this._deps && this.finalized) {
      console.log('compute deps', this._deps);
      this._deps.forEach((dep) => dep.value);
    }
  }

  compute() {
    batchStart();
    const prevContext = getCurrentContext();
    const currentContext = setupCurrentContext(this);
    setRunningReaction(this);
    this._computeDeps();

    if (this._deps && getMax(this._deps) === this._version) {
      setCurrentContext(prevContext);
      batchEnd();
      return;
    }

    try {
      this._computeFn();
    } finally {
      if (!this.finalized) {
        this._deps = Array.from(currentContext);
        console.log('register deps', this._deps);
      }
      if (!this.initialized) {
        this.registerDependencies();
      }
      setCurrentContext(prevContext);
      setRunningReaction(null);
      batchEnd();
      if (this.initialized && !this.finalized) {
        this._finalized = true;
      }
      if (this._deps) {
        this._version = getMax(this._deps);
      }
    }
  }

  schedule() {
    scheduleReaction(this);
  }

  registerDependencies() {
    this._deps?.forEach((dep) => {
      registerDependencyForReaction(dep, this);
    });
  }

  dispose() {
    this.isDisposed = true;
    this._cleanupFn?.();
  }
}
