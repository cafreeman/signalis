import { CleanupFn, ComputeFn, Reaction } from './reaction';

export function createEffect(fn: ComputeFn, dispose?: CleanupFn): () => void {
  const effect = new Reaction(fn, dispose);
  return effect.dispose.bind(effect);
}
