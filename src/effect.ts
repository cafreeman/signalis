import { type Derived } from './derived';
import { MANAGER } from './manager';
import { type Signal } from './signal';
import { getMax, Tag } from './tag';

type ComputeFn = () => void | (() => void);

export class Effect {
  #computeFn: ComputeFn;
  #version: number;
  #prevTags: Array<Tag>;
  #deps?: Array<Signal | Derived>;
  #cleanupFn?: () => void;

  constructor(fn: ComputeFn, deps?: Array<Signal | Derived>) {
    this.#computeFn = fn;
    this.#version = MANAGER.version;
    this.#deps = deps;
    MANAGER.effects.add(this);
    const maybeCleanupFn = this.compute();

    if (typeof maybeCleanupFn === 'function') {
      this.#cleanupFn = maybeCleanupFn;
    }
  }

  get hasDeps() {
    return this.#deps && this.#deps.length > 0;
  }

  #computeDeps() {
    if (this.#deps) {
      this.#deps.forEach((dep) => dep.value);
    }
  }

  compute() {
    let prevCompute = MANAGER.currentCompute;
    MANAGER.currentCompute = new Set();
    MANAGER.runningEffect = this;

    this.#computeDeps();

    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      MANAGER.runningEffect = null;
      MANAGER.currentCompute = prevCompute;
      return;
    }

    let result: ReturnType<ComputeFn>;

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

  dispose() {
    if (this.#cleanupFn) {
      this.#cleanupFn();
    }
    return MANAGER.effects.delete(this);
  }
}

export function createEffect(fn: () => void, deps?: Array<Signal | Derived>): () => boolean {
  const effect = new Effect(fn, deps);
  return effect.dispose.bind(effect);
}
