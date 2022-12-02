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
} from './state.js';
import { getMax } from './tag.js';
import type { ReactiveValue } from './types.js';

export type ComputeFn = () => void;
export type CleanupFn = () => void;

export class Reaction {
  private _computeFn: ComputeFn;
  private _cleanupFn?: CleanupFn | undefined;
  private _deps?: Array<ReactiveValue>;
  private _version: number = getVersion();
  /**
   * A reaction is initialized when it has been run for the first time and it's initial dependencies
   * have been captured and added to the registry. When derived values detect that they are being
   * run inside of an uninitialized Reaction, they add all of their dependencies to the Reaction's
   * dependencies so that the Reaction has full knowledge of the full dependency chain.
   */
  private _initialized = false;
  /**
   * A reaction is finalized once it has been fully computed for a second time and has adjusted
   * its locally-tracked dependencies to only include direct dependencies. Since derived values
   * only sync their dependencies for uninitialized Reactions, this second run will result in us
   * only capturing direct dependencies, which in turn allows finalized Reactions to be much
   * smarter about when they actually re-run.
   */
  private _finalized = false;
  isDisposed = false;

  constructor(fn: ComputeFn, dispose?: CleanupFn) {
    this._computeFn = fn;
    this._cleanupFn = dispose;
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
      this._deps.forEach((dep) => dep.value);
    }
  }

  trap(trapFn: ComputeFn) {
    if (this.isDisposed) {
      return;
    }
    const prevContext = getCurrentContext();
    const currentContext = setupCurrentContext(this);

    try {
      trapFn();
    } finally {
      // If this is the first run of the reaction, we know we're going to capture *all* dependencies
      // rather than only the direct dependencies, so we want to make sure we register dependencies
      // when that happens
      this._deps = Array.from(currentContext);
      if (!this.initialized) {
        this.registerDependencies();
      }

      setCurrentContext(prevContext);
    }
  }

  compute() {
    if (this.isDisposed) {
      return;
    }
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
      // TODO: Figure out if it's safe to to lock the dependencies in place or if we need to
      // go back to resetting the deps array on every compute
      if (!this.finalized) {
        this._deps = Array.from(currentContext);
      }

      setCurrentContext(prevContext);
      setRunningReaction(null);

      if (this.initialized && !this.finalized) {
        this._finalized = true;
      }

      if (!this.initialized && !this.finalized) {
        this._initialized = true;
      }

      if (this._deps) {
        this._version = getMax(this._deps);
      }
      batchEnd();
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
