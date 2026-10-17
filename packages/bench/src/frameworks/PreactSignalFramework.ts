import { batch, computed, effect, signal } from '@preact/signals-core';
import type { Computed, ReactiveFramework, Signal } from '../ReactiveFramework.js';

function preactSignal<T>(initialValue: T): Signal<T> {
  const s = signal(initialValue);
  return {
    write: (v: T) => (s.value = v),
    read: (): T => s.value,
  };
}

function preactComputed<T>(fn: () => T): Computed<T> {
  const c = computed(fn);
  return {
    read: (): T => c.value,
  };
}

function preactEffect(fn: () => void): void {
  // effect runs the callback immediately and returns a disposal function, which the benchmark
  // doesn't need (see the README)
  effect(fn);
}

export const preactSignalFramework: ReactiveFramework = {
  name: 'Preact Signals',
  signal: preactSignal,
  computed: preactComputed,
  effect: preactEffect,
  withBatch: batch,
  withBuild: (fn) => fn(),
};
