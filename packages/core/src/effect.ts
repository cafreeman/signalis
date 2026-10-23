import { Reaction } from './reaction.js';

export function createEffect(fn: () => void | (() => void)): () => void {
  const effect = new Reaction(function (this: Reaction) {
    return this.trap(fn);
  });
  effect._source = 'effect';

  try {
    effect.compute();
  } catch (error) {
    // The caller gets the error and no disposer, so nothing else could ever stop this effect
    effect.dispose();
    throw error;
  }

  return effect.dispose.bind(effect);
}
