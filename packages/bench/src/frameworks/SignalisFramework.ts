import { batch, createDerived, createEffect, createSignal } from '@signalis/core';
import type { Computed, ReactiveFramework, Signal } from '../ReactiveFramework.js';

function signalisSignal<T>(initialValue: T): Signal<T> {
  const s = createSignal(initialValue);
  return {
    write: (v: T) => (s.value = v),
    read: (): T => s.value,
  };
}

function signalisComputed<T>(fn: () => T): Computed<T> {
  const c = createDerived(fn);
  return {
    read: (): T => c.value,
  };
}

function signalisEffect(fn: () => void): void {
  // createEffect runs the callback immediately and returns a disposal function; the benchmark
  // doesn't dispose graphs between scenarios (see the README)
  createEffect(fn);
}

export const signalisFramework: ReactiveFramework = {
  name: 'Signalis',
  signal: signalisSignal,
  computed: signalisComputed,
  effect: signalisEffect,
  // passed straight through: wrapping it to forward a result would allocate a closure per write
  withBatch: batch,
  withBuild: (fn) => fn(),
};
