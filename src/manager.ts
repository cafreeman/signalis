import type { Effect } from './effect';
import type { Tag } from './tag';

class Manager {
  #version = 0;
  batchCount = 0;
  batchIteration = 0;
  currentCompute: Set<Tag> | null = null;
  runningEffect: Effect | null = null;
  effects = new Set<Effect>();

  get isEffectRunning(): boolean {
    return !!this.runningEffect;
  }

  incrementVersion(): number {
    return ++this.#version;
  }

  get version(): number {
    return this.#version;
  }

  onTagDirtied = () => {};

  batchStart(): void {
    this.batchCount++;
  }

  batchEnd(): void {
    this.batchCount--;
  }

  runEffects(): void {
    this.effects.forEach((effect) => {
      effect.compute();
    });
  }
}

export const MANAGER = new Manager();
