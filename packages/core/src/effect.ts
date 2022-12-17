import { Reaction } from './reaction.js';

export function createEffect(fn: () => void | (() => void)): () => void {
  const effect = new Reaction(function (this: Reaction) {
    return this.trap(fn);
  });

  effect.compute();

  return effect.dispose.bind(effect);
}
