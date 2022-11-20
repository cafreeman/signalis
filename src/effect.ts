import type { Derived } from './derived';
import { MANAGER } from './manager';
import type { Signal } from './signal';
import { getMax, Tag } from './tag';

type ComputeFn = () => void | (() => void);

export class Effect {
  #computeFn: ComputeFn;
  #version: number;
  #prevTags?: Array<Tag>;
  #deps?: Array<Signal<unknown> | Derived<unknown>> | undefined;
  #cleanupFn?: () => void;

  constructor(fn: ComputeFn, deps?: Array<Signal<unknown> | Derived<unknown>>) {
    this.#computeFn = fn;
    this.#version = MANAGER.version;
    this.#deps = deps;
    MANAGER.effects.add(this);
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
    const prevCompute = MANAGER.currentCompute;
    MANAGER.currentCompute = new Set();
    MANAGER.runningEffect = this;

    this.#computeDeps();

    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      MANAGER.runningEffect = null;
      MANAGER.currentCompute = prevCompute;
      return;
    }

    let result: (() => void) | void;

    try {
      result = this.#computeFn();
    } finally {
      this.#prevTags = Array.from(MANAGER.currentCompute);
      this.#version = getMax(this.#prevTags);

      MANAGER.currentCompute = prevCompute;
      MANAGER.runningEffect = null;
    }

    return result;
  }

  dispose(): boolean {
    if (this.#cleanupFn) {
      this.#cleanupFn();
    }
    return MANAGER.effects.delete(this);
  }
}

export function createEffect(
  fn: () => void,
  deps?: Array<Signal<unknown> | Derived<unknown>>
): () => boolean {
  const effect = new Effect(fn, deps);
  return effect.dispose.bind(effect);
}
