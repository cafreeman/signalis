import { Effect } from './effect';
import { Tag } from './tag';

class Manager {
  #version = 0;
  currentCompute: Set<Tag> | null = null;
  effects = new Set<Effect>();

  incrementVersion() {
    console.log('incrementing to: ', this.#version + 1);
    return ++this.#version;
  }

  get version() {
    return this.#version;
  }

  onTagDirtied = () => {};
}

export const MANAGER = new Manager();
