import { createDerived, type Derived } from '@signalis/core';
import type { DependencyList } from 'react';
import { useRef, useMemo } from 'react';
import { EMPTY } from './empty.js';

export function useDerived<T>(fn: () => T, deps: DependencyList = EMPTY): Derived<T> {
  const derivedRef = useRef<Derived<T> | null>(null);

  // Recreate derived when deps change
  useMemo(() => {
    derivedRef.current = createDerived(fn);
  }, deps);

  // Initialize on first render
  if (!derivedRef.current) {
    derivedRef.current = createDerived(fn);
  }

  return derivedRef.current;
}
