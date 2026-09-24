import { createDerived, type Derived } from '@signalis/core';
import type { DependencyList } from 'react';
import { useEffect, useState } from 'react';
import { EMPTY } from './empty.js';

function areInputsEqual(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[],
): boolean {
  // The `EMPTY` list is a shared module constant, so the default case always
  // hits this fast path
  if (previous === next) {
    return true;
  }

  if (!previous || previous.length !== next.length) {
    return false;
  }

  for (let i = 0; i < next.length; i++) {
    if (Object.is(previous[i], next[i])) {
      continue;
    }
    return false;
  }

  return true;
}

export function useDerived<T>(fn: () => T, deps: DependencyList = EMPTY): Derived<T> {
  const [state, setState] = useState(() => ({
    derived: createDerived(fn),
    deps: deps as readonly unknown[],
  }));

  // Deps exist only for non-reactive inputs (e.g. props); reactive
  // dependencies are tracked automatically by the derived itself. When deps
  // change, we adjust state during render (React's sanctioned pattern for
  // prop-derived state): React discards this render's output and immediately
  // re-renders with the replacement, so a render that ends up abandoned can
  // never mutate the committed subscription. Creating a `Derived` is cheap:
  // it is lazy, so it neither computes nor subscribes until its `value` is
  // read.
  if (!areInputsEqual(state.deps, deps)) {
    setState({ derived: createDerived(fn), deps: deps as readonly unknown[] });
  }

  // Dispose the derived that was active before this one (on deps change) and
  // the current one on unmount. Effect cleanup runs after commit, so
  // disposal is always tied to a committed render. Reading `value` in setup
  // re-activates a derived that was disposed by React Strict Mode's simulated
  // unmount: a disposed derived recomputes and re-subscribes on read.
  useEffect(() => {
    state.derived.value;
    return () => {
      state.derived.dispose();
    };
  }, [state.derived]);

  return state.derived;
}
