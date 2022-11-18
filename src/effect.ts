import { getMax, Tag } from './tag';
import { GLOBAL_VERSION } from './version';

export class Effect {
  #computeFn: () => void;
  #version: number;
  #prevTags: Array<Tag>;

  constructor(fn: () => void) {
    this.#computeFn = fn;
    this.#version = GLOBAL_VERSION.value;
    GLOBAL_VERSION.effects.add(this);
  }

  compute() {
    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      return;
    }

    let prevCompute = GLOBAL_VERSION.currentComputation;

    GLOBAL_VERSION.currentComputation = new Set();

    try {
      this.#computeFn();
    } finally {
      this.#prevTags = Array.from(GLOBAL_VERSION.currentComputation);
      this.#version = getMax(this.#prevTags);

      GLOBAL_VERSION.currentComputation = prevCompute;
    }
  }

  dispose() {
    return GLOBAL_VERSION.effects.delete(this);
  }
}

export function createEffect(fn: () => void) {
  const effect = new Effect(fn);
  return effect.dispose.bind(effect);
}
