import { createDerived, type Derived } from '@signalis/core';
import type { DependencyList } from 'react';
import { useEffect, useRef } from 'react';
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
  const derivedRef = useRef<Derived<T> | null>(null);
  const previousDepsRef = useRef<readonly unknown[] | undefined>(undefined);

  // Create (or, when `deps` change, re-create) the derived during render.
  // Creating a `Derived` is cheap: it is lazy, so it neither computes nor
  // subscribes to its sources until its `value` is read. Deps exist only for
  // non-reactive inputs (e.g. props); reactive dependencies are tracked
  // automatically by the derived itself.
  if (derivedRef.current === null || !areInputsEqual(previousDepsRef.current, deps)) {
    // Dispose the previous derived (if any) so it stops observing its old
    // sources; otherwise it would leak by remaining in their observer lists
    derivedRef.current?.dispose();
    derivedRef.current = createDerived(fn);
    previousDepsRef.current = deps;
  }

  // Dispose the derived on unmount so it drops out of the reactivity graph.
  // If it is subsequently read again (e.g. a re-render after React StrictMode's
  // simulated unmount), reading its value will transparently re-subscribe it.
  useEffect(() => {
    return () => {
      derivedRef.current?.dispose();
    };
  }, EMPTY);

  return derivedRef.current;
}
