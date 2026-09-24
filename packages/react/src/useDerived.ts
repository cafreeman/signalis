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

  // Reading a derived normally mutates the reactive graph by subscribing it
  // to its sources. Defer that reconciliation until after commit so a render
  // React abandons (for example, after Suspense) leaves no orphaned
  // subscriptions behind.
  state.derived._beginSourceCollection();

  useEffect(() => {
    state.derived._commitSourceCollection();
    // Strict Mode runs cleanup and setup without a render in between.
    // Re-reading here resurrects a derived that cleanup disposed.
    state.derived.value;
  });

  // Dispose the derived that was active before this one (on deps change) and
  // the current one on unmount. Cleanup only runs for committed effects.
  useEffect(() => {
    return () => {
      state.derived.dispose();
    };
  }, [state.derived]);

  return state.derived;
}
