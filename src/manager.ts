import type { Derived } from './derived';
import type { Effect } from './effect';
import type { Tag } from './tag';

class Manager {
  #version = 0;

  batchCount = 0;

  contexts = new WeakMap<Derived<unknown> | Effect, Set<Tag>>();
  currentContext: Set<Tag> | null = null;

  effects = new Set<Effect>();
  runningEffect: Effect | null = null;

  get isEffectRunning(): boolean {
    return !!this.runningEffect;
  }

  incrementVersion(): number {
    return ++this.#version;
  }

  get version(): number {
    return this.#version;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
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

  fetchContext(k: Derived<unknown> | Effect): Set<Tag> {
    let context = this.contexts.get(k);

    if (!context) {
      context = new Set<Tag>();
      this.contexts.set(k, context);
    }

    return context;
  }
}

export const MANAGER = new Manager();
