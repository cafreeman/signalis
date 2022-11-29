import { createSignal } from '@reactiv/core';
import { useMemo } from 'react';
import { EMPTY } from './empty';

export function useSignal<T>(value: T) {
  return useMemo(() => createSignal(value), EMPTY);
}
