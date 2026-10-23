import { Reaction } from './reaction.js';

interface WhenOptions {
  final?: boolean;
}

export function when(predicate: () => boolean, fn: () => void, options?: WhenOptions): () => void {
  let reaction: Reaction;

  if (options && options.final) {
    reaction = new Reaction(function (this: Reaction) {
      let cond = false;

      this.trap(() => {
        cond = predicate();
      });

      if (cond) {
        // Dispose first, so the callback runs at most once even if it throws
        this.dispose();
        fn();
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
  reaction._source = 'when';

  try {
    reaction.compute();
  } catch (error) {
    reaction.dispose();
    throw error;
  }

  return reaction.dispose.bind(reaction);
}
