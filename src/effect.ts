import {
  registerEffect,
  setupCurrentContext,
  getCurrentContext,
  getVersion,
  setRunningEffect,
  setCurrentContext,
  removeEffect,
} from './state';
import { getMax, Tag } from './tag';
import type { ReactiveValue } from './types';

type ComputeFn = () => void | (() => void);

export class Effect {
  #computeFn: ComputeFn;
  #version: number;
  #prevTags?: Array<Tag>;
  #deps?: Array<ReactiveValue<unknown>> | undefined;
  #cleanupFn?: () => void;

  constructor(fn: ComputeFn, deps?: Array<ReactiveValue<unknown>>) {
    this.#computeFn = fn;
    this.#version = getVersion();
    this.#deps = deps;
    registerEffect(this);
    const maybeCleanupFn = this.compute();

    if (typeof maybeCleanupFn === 'function') {
      this.#cleanupFn = maybeCleanupFn;
    }
  }

  get hasDeps(): boolean {
    return this.#deps ? this.#deps.length > 0 : false;
  }

  #computeDeps(): void {
    if (this.#deps) {
      this.#deps.forEach((dep) => dep.value);
    }
  }

  compute(): (() => void) | void {
    const prevContext = getCurrentContext();

    const currentContext = setupCurrentContext(this);

    setRunningEffect(this);

    this.#computeDeps();

    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      setRunningEffect(null);
      setCurrentContext(prevContext);
      return;
    }

    let result: (() => void) | void;

    try {
      result = this.#computeFn();
    } finally {
      this.#prevTags = Array.from(currentContext);
      this.#version = getMax(this.#prevTags);

      setCurrentContext(prevContext);
      setRunningEffect(null);
    }

    return result;
  }

  dispose(): boolean {
    if (this.#cleanupFn) {
      this.#cleanupFn();
    }
    return removeEffect(this);
  }
}

export function createEffect(fn: () => void, deps?: Array<ReactiveValue<unknown>>): () => boolean {
  const effect = new Effect(fn, deps);
  return effect.dispose.bind(effect);
}
