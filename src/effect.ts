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
  }

  compute() {
    if (this.#prevTags && getMax(this.#prevTags) === this.#version) {
      return;
    }

    let prevCompute = MANAGER.currentCompute;

    MANAGER.currentCompute = new Set();

    try {
      this.#computeFn();
    } finally {
      this.#prevTags = Array.from(MANAGER.currentCompute);
      this.#version = getMax(this.#prevTags);

      MANAGER.currentCompute = prevCompute;
    }
  }

  dispose() {
    return MANAGER.effects.delete(this);
  }
}

export function createEffect(fn: () => void) {
  const effect = new Effect(fn);
  return effect.dispose.bind(effect);
}
