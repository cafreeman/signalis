import { Reaction } from './reaction.js';

interface WhenOptions {
  final?: boolean;
}

export function when(predicate: () => boolean, fn: () => void, options?: WhenOptions) {
  let reaction: Reaction;

  if (options && options.final) {
    reaction = new Reaction(function (this: Reaction) {
      let cond = false;
      this.trap(() => {
        cond = predicate();
      });
      if (cond) {
        fn();
        this.dispose();
      }
    });
  } else {
    reaction = new Reaction(function (this: Reaction) {
      let cond = false;
      this.trap(() => {
        cond = predicate();
      });

      if (cond) {
        fn();
      }
    });
  }

  reaction.compute();

  return reaction.dispose.bind(reaction);
}
