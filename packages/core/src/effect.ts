import { CleanupFn, ComputeFn, Reaction } from './reaction.js';

export function createEffect(fn: ComputeFn, dispose?: CleanupFn): () => void {
  const effect = new Reaction(function (this: Reaction) {
    this.trap(fn);
  }, dispose);

  effect.compute();

  return effect.dispose.bind(effect);
}
