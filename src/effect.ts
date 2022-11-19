import { getMax, Tag } from './tag';
import { MANAGER } from './manager';

export class Effect {
  #computeFn: () => void;
  #version: number;
  #prevTags: Array<Tag>;

  constructor(fn: () => void) {
    this.#computeFn = fn;
    this.#version = MANAGER.version;
    MANAGER.effects.add(this);
    this.compute();
  }

  compute() {
    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      return;
    }

    MANAGER.isEffectRunning = true;

    let prevCompute = MANAGER.currentCompute;
    MANAGER.currentCompute = new Set();

    MANAGER.computeContext = this;

    try {
      this.#computeFn();
    } finally {
      this.#prevTags = Array.from(MANAGER.currentCompute);
      this.#version = getMax(this.#prevTags);

      MANAGER.currentCompute = prevCompute;
      MANAGER.isEffectRunning = false;
    }
  }

  dispose() {
    return MANAGER.effects.delete(this);
  }
}

export function createEffect(fn: () => void): () => boolean {
  const effect = new Effect(fn);
  return effect.dispose.bind(effect);
}
