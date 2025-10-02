import { createEffect } from '@signalis/core';
import type { DependencyList } from 'react';
import { useEffect } from 'react';
import { EMPTY } from './empty.js';

export function useSignalEffect(fn: () => void | (() => void), deps: DependencyList = EMPTY): void {
  useEffect(() => {
    return createEffect(fn);
  }, deps);
}
