import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';
import type { Computed, ReactiveFramework, Signal } from '../ReactiveFramework.js';

function alienSignal<T>(initialValue: T): Signal<T> {
  const s = signal(initialValue);
  return {
    write: (v: T) => s(v),
    read: (): T => s(),
  };
}

function alienComputed<T>(fn: () => T): Computed<T> {
  const c = computed(() => fn());
  return {
    read: (): T => c(),
  };
}

function alienEffect(fn: () => void): void {
  // effect runs the callback immediately and returns a disposal function, which the benchmark
  // doesn't need (see the README)
  effect(fn);
}

export const alienFramework: ReactiveFramework = {
  name: 'Alien Signals',
  signal: alienSignal,
  computed: alienComputed,
  effect: alienEffect,
  withBatch: <T>(fn: () => T): T => {
    startBatch();
    try {
      return fn();
    } finally {
      endBatch();
    }
  },
  withBuild: (fn) => fn(),
};
