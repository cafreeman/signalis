import { Reaction } from './reaction';

interface WhenOptions {
  final?: boolean;
}

export function when(predicate: () => boolean, fn: () => void, options?: WhenOptions) {
  let reaction: Reaction;

  if (options && options.final) {
    reaction = new Reaction(function (this: Reaction) {
      const cond = predicate();
      if (cond) {
        fn();
        this.dispose();
      }
    });
  } else {
    reaction = new Reaction(() => {
      const cond = predicate();
      if (cond) {
        fn();
      }
    });
  }

  return reaction.dispose.bind(reaction);
}
