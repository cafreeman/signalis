import { GLOBAL_VERSION } from './version';

export const REVISION = Symbol('Revision');

export type Tag = {
  [REVISION]: number;
};

export function createTag(): Tag {
  return {
    [REVISION]: GLOBAL_VERSION.value,
  };
}

export function consumeTag(t: Tag) {
  if (GLOBAL_VERSION.currentComputation) {
    GLOBAL_VERSION.currentComputation.add(t);
  }
}

export function dirtyTag(t: Tag) {
  t[REVISION] = GLOBAL_VERSION.increment();
  GLOBAL_VERSION.effects.forEach((effect) => {
    effect.compute();
  });
  GLOBAL_VERSION.onTagDirtied();
}

export function getMax(tags: Array<Tag>) {
  return Math.max(...tags.map((t) => t[REVISION]));
}

export function setOnTagDirtied(fn: () => void) {
  GLOBAL_VERSION.onTagDirtied = fn;
}
