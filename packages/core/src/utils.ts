import type { Derived } from './derived.js';
import type { Signal } from './signal.js';
import { getContextIndex, getCurrentContext } from './state.js';
import type { ReactiveFunction } from './types.js';

// Remove a given ReactiveFunction from all of its sources' observer arrays. In essence, this breaks
// the link between a ReactiveFunction and all of its sources. We use this to "reset" a
// ReactiveFunction's dependencies prior to re-computing it in order to ensure that we don't
// leak dependencies between computations
export function unlinkObservers(target: ReactiveFunction) {
  const { _sources: sources } = target;
  if (!sources) {
    return;
  }

  for (let i = getContextIndex(); i < sources.length; i++) {
    const source = sources[i] as Signal<unknown> | Derived<unknown>;
    if (!source._observers || source._observers.length === 0) {
      return;
    }
    spliceWhenKnown(source._observers, target);
  }
}

function spliceWhenKnown<T>(array: Array<T>, target: T): Array<T> {
  const idx = array.findIndex((v) => v === target);
  assert(idx !== -1, 'item must be in the array');
  // Since `assert` gets stripped in prod builds, we want to still handle the case where we don't
  // find a match. If we don't return early here, we end up setting the target on the index `-1`
  // and then calling `pop`, which leaves us with an array of length 0...with a `-1` property
  // containing the observer :sob:
  if (idx === -1) {
    return array;
  }

  const last = array[array.length - 1];
  assert(!!last); // array cannot be empty *and* idx not be set!

  array[idx] = last;
  array.pop();

  return array;
}

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

// This function is responsible for all of the bookkeeping we need to do after running a reactive
// computation in order to correctly track/update all of a computation's dependencies. Highly
// influenced by Reactively's extremely clever optimization work here https://github.com/modderme123/reactively/commit/fde309bb2966e5d382868169f9b8905532596ec5#diff-f63fb32fca85d8e177d6400ce078818a4815b80ac7a3319b60d3507354890992
export function reconcileSources(node: ReactiveFunction) {
  const context = getCurrentContext();
  const idx = getContextIndex();

  // If a current context exists, it means we encountered at least one dependency that has changed
  // (or that it's the very first run of the reactive function)
  if (context) {
    unlinkObservers(node);

    // if the node already has sources but the context index is > 0, it means that the node's list
    // of dependencies is partially unchanged (from the first spot up to wherever the context index
    // is) but then diverged once we hit the context index. In this case, we update the node's
    // sources by adjusting its size and then filling it from the context index forward
    if (node._sources && idx > 0) {
      node._sources.length = idx + context.length;

      for (let i = 0; i < context.length; i++) {
        node._sources[idx + i] = context[i]!;
      }
    } else {
      // in this case, we either didn't have any sources before, or they changed so completely
      // that we couldn't share any with the previous run, so we just overwrite the whole thing
      node._sources = context;
    }

    // add ourselves to each new/changed source's list of observers now
    for (let i = idx; i < node._sources.length; i++) {
      const source = node._sources[i];
      if (source) {
        if (source._observers) {
          source._observers.push(node);
        } else {
          source._observers = [node];
        }
      }
    }
  } else if (node._sources && idx < node._sources.length) {
    // if we're here, it's because the number of sources we referenced during the computation
    // (essentially the context index) is less than the current number of sources, which means
    // that while we didn't gain any new sources, or change the order in which they were referenced
    // (which would be caught above), we did *lose* some dependencies, and so we still need to
    // remove ourselves from the sources we dropped and trim our sources list to match
    unlinkObservers(node);
    node._sources.length = idx;
  }
}
