import {
  registerEffect,
  setupCurrentContext,
  getCurrentContext,
  getVersion,
  setRunningEffect,
  setCurrentContext,
  removeEffect,
} from './state';
import { getMax, Tagged } from './tag';
import type { ReactiveValue } from './types';

type ComputeFn = () => void | (() => void);

class Effect {
  private _computeFn: ComputeFn;
  private _version: number;
  private _prevTags?: Array<Tagged>;
  private _deps?: Array<ReactiveValue<unknown>> | undefined;
  private _cleanupFn?: () => void;

  constructor(fn: ComputeFn, deps?: Array<ReactiveValue<unknown>>) {
    this._computeFn = fn;
    this._version = getVersion();
    this._deps = deps;
    registerEffect(this);
    const maybeCleanupFn = this.compute();

    if (typeof maybeCleanupFn === 'function') {
      this._cleanupFn = maybeCleanupFn;
    }
  }

  get hasDeps(): boolean {
    return this._deps ? this._deps.length > 0 : false;
  }

  private _computeDeps(): void {
    if (this._deps) {
      this._deps.forEach((dep) => dep.value);
    }
  }

  compute(): (() => void) | void {
    const prevContext = getCurrentContext();

    const currentContext = setupCurrentContext(this);

    setRunningEffect(this);

    this._computeDeps();

    if (this._prevTags && getMax(this._prevTags) === this._version) {
      setRunningEffect(null);
      setCurrentContext(prevContext);
      return;
    }

    let result: (() => void) | void;

    try {
      result = this._computeFn();
    } finally {
      this._prevTags = Array.from(currentContext);
      this._version = getMax(this._prevTags);

      setCurrentContext(prevContext);
      setRunningEffect(null);
    }

    return result;
  }

  dispose(): boolean {
    if (this._cleanupFn) {
      this._cleanupFn();
    }
    return removeEffect(this);
  }
}

export type { Effect };

export function createEffect(fn: () => void, deps?: Array<ReactiveValue<unknown>>): () => boolean {
  const effect = new Effect(fn, deps);
  return effect.dispose.bind(effect);
}
