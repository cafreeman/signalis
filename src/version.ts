import { Effect } from './effect';
import { Tag } from './tag';

class Version {
  #version = 0;
  currentComputation: Set<Tag> | null = null;
  effects = new Set<Effect>();

  increment() {
    console.log('incrementing to: ', this.#version + 1);
    return ++this.#version;
  }

  get value() {
    return this.#version;
  }

  onTagDirtied = () => {};
}

export const GLOBAL_VERSION = new Version();
