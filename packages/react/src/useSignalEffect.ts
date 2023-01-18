import { createEffect } from '@signalis/core';
import { useCallback, useEffect } from 'react';
import { EMPTY } from './empty.js';

export function useSignalEffect(fn: () => void | (() => void)): void {
  const cachedFn = useCallback(fn, EMPTY);

  useEffect(() => {
    return createEffect(() => cachedFn());
  }, EMPTY);
}
