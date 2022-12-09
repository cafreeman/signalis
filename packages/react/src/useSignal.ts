import { createSignal, type Signal } from '@signalis/core';
import { useMemo } from 'react';
import { EMPTY } from './empty.js';

export function useSignal(value?: null | undefined): Signal<unknown>;
export function useSignal<T extends {}>(value: T): Signal<T>;
export function useSignal<T extends {}>(value?: T | null | undefined): Signal<T> | Signal<unknown> {
  return useMemo(() => (value ? createSignal(value) : createSignal(null)), EMPTY);
}
