import {
  Context,
  getCurrentContext,
  getVersion,
  registerEffect,
  removeEffect,
  setCurrentContext,
  setRunningEffect,
  setupCurrentContext,
} from './state';
import { getMax, Tagged } from './tag';
import type { ReactiveValue } from './types';

type ComputeFn = () => void | (() => void);

type STARTED = typeof STARTED;
const STARTED = 'started';
type STOPPED = typeof STOPPED;
const STOPPED = 'stopped';

class Effect {
  _computeFn: ComputeFn;
  private _version: number;
  private _prevTags?: Array<Tagged>;
  private _deps?: Array<ReactiveValue<unknown>> | undefined;
  private _cleanupFn?: () => void;
  private _status: STARTED | STOPPED = STOPPED;
  private _prevContext: Context | null = null;
  private _currentContext: Context | null = null;

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

  _start() {
    this._status = STARTED;
    this._prevContext = getCurrentContext();

    this._currentContext = setupCurrentContext(this);
  }

  _stop() {
    if (this._currentContext) {
      this._prevTags = Array.from(this._currentContext);
      this._version = getMax(this._prevTags);
    }

    this._prevContext = null;
    setCurrentContext(this._prevContext);
    setRunningEffect(null);
    this._status = STOPPED;
  }

  compute(): (() => void) | void {
    if (this._status === STOPPED) {
      this._start();
    }

    setRunningEffect(this);

    this._computeDeps();

    console.log('effect prev tags', this._prevTags);

    if (this._prevTags && getMax(this._prevTags) === this._version) {
      this._prevContext = null;
      setCurrentContext(this._prevContext);
      setRunningEffect(null);
      this._status = STOPPED;
      return;
    }

    let result: (() => void) | void;

    try {
      result = this._computeFn();
    } finally {
      this._stop();
    }

    return result;
  }

  dispose(): boolean {
    console.log('DISPOSE EFFECT');
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
