import { Derived } from './derived';
import { Effect } from './effect';
import { Tag } from './tag';

class Manager {
  #version = 0;
  batchCount = 0;
  batchIteration = 0;
  currentCompute: Set<Tag> | null = null;
  computeContext: Derived | Effect | null = null;
  effects = new Set<Effect>();
  isEffectRunning = false;

  incrementVersion() {
    return ++this.#version;
  }

  get version() {
    return this.#version;
  }

  onTagDirtied = () => {};

  batchStart() {
    this.batchCount++;
  }

  batchEnd() {
    this.batchCount--;
  }

  runEffects() {
    this.effects.forEach((effect) => {
      effect.compute();
    });
  }
}

export const MANAGER = new Manager();
