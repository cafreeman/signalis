import { createDerived, type Derived } from '@signalis/core';
import { useCallback, useMemo } from 'react';
import { EMPTY } from './empty.js';

export function useDerived<T>(fn: () => T): Derived<T> {
  const factory = useCallback(() => createDerived(fn), EMPTY);

  return useMemo(factory, EMPTY);
}
