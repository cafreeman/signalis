import { MANAGER } from './manager';
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
    const prevContext = MANAGER.currentContext;

    const context = MANAGER.fetchContext(this);
    context.clear();
    MANAGER.currentContext = context;

    MANAGER.runningEffect = this;

    this.#computeDeps();

    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      MANAGER.runningEffect = null;
      MANAGER.currentContext = prevCompute;
      return;
    }

    let result: (() => void) | void;

    try {
      result = this.#computeFn();
    } finally {
      this.#prevTags = Array.from(MANAGER.currentContext);
      this.#version = getMax(this.#prevTags);

      MANAGER.currentContext = prevCompute;
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

export function createEffect(fn: () => void, deps?: Array<ReactiveValue<unknown>>): () => boolean {
  const effect = new Effect(fn, deps);
  return effect.dispose.bind(effect);
}
