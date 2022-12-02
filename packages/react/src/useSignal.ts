import { createSignal } from '@signalis/core';
import { useMemo } from 'react';
import { EMPTY } from './empty.js';

export function useSignal<T>(value: T) {
  return useMemo(() => createSignal(value), EMPTY);
}
