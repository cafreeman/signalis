import { createSignal, type Signal } from '@signalis/core';
import { useMemo } from 'react';
import { EMPTY } from './empty.js';

export function useSignal(): Signal<unknown>;
export function useSignal(value: null | undefined): Signal<unknown>;
export function useSignal<T>(initializer: () => T): Signal<T>;
// Exclude<T, Function> prevents functions from matching this overload - they should match the initializer overload above
export function useSignal<T extends {}>(value: Exclude<T, Function>): Signal<T>;
export function useSignal<T>(
  valueOrInitializer?: T | (() => T) | null | undefined,
): Signal<T> | Signal<unknown> {
  return useMemo(() => {
    // Handle no arguments
    if (valueOrInitializer === undefined) {
      return createSignal();
    }

    // Detect function initializer pattern
    if (typeof valueOrInitializer === 'function') {
      // Call initializer to get value
      return createSignal((valueOrInitializer as () => T)());
    }

    // Direct value
    return createSignal(valueOrInitializer as T);
  }, EMPTY);
}
