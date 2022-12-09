import { Reaction } from './reaction.js';

export function createEffect(fn: () => void, cleanup?: () => void) {
  const effect = new Reaction(function (this: Reaction) {
    this.trap(fn);
  }, cleanup);

  effect.compute();

  return effect.dispose.bind(effect);
}
