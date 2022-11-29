import { createDerived } from '@reactiv/core';
import { useCallback, useMemo } from 'react';
import { EMPTY } from './empty';

export function useDerived<T>(fn: () => T) {
  const factory = useCallback(() => createDerived(fn), EMPTY);

  return useMemo(factory, EMPTY);
}
