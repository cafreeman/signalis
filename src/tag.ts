import { MANAGER } from './manager';

export const REVISION = Symbol('Revision');

export type Tag = {
  [REVISION]: number;
};

export function createTag(): Tag {
  return {
    [REVISION]: MANAGER.version,
  };
}

export function consumeTag(t: Tag) {
  if (MANAGER.currentCompute) {
    MANAGER.currentCompute.add(t);
  }
}

export function dirtyTag(t: Tag) {
  t[REVISION] = MANAGER.incrementVersion();

  MANAGER.effects.forEach((effect) => {
    effect.compute();
  });

  MANAGER.onTagDirtied();
}

export function getMax(tags: Array<Tag>) {
  return Math.max(...tags.map((t) => t[REVISION]));
}

export function setOnTagDirtied(fn: () => void) {
  MANAGER.onTagDirtied = fn;
}
