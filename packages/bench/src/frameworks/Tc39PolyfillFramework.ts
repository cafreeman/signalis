import { Signal } from 'signal-polyfill';
import type { Computed, ReactiveFramework, Signal as ISignal } from '../ReactiveFramework.js';

/**
 * One watcher for every effect, as in the proposal README's effect example. Its notify callback
 * is a no-op because pending effects are drained synchronously at each batch boundary.
 */
const watcher = new Signal.subtle.Watcher(() => {});

function flushPendingEffects(): void {
  for (const s of watcher.getPending()) {
    s.get();
  }
  // re-arm the watcher so it notifies on the next change
  watcher.watch();
}

function tc39Signal<T>(initialValue: T): ISignal<T> {
  const s = new Signal.State(initialValue);
  return {
    write: (v: T) => s.set(v),
    read: (): T => s.get(),
  };
}

function tc39Computed<T>(fn: () => T): Computed<T> {
  const c = new Signal.Computed(() => fn());
  return {
    read: (): T => c.get(),
  };
}

/**
 * The TC39 proposal intentionally doesn't define an effect primitive, so effects are watched
 * computeds, following the proposal's README. Instead of scheduling a microtask, this adapter
 * flushes them synchronously at each batch boundary, so effect work lands inside the timed region
 * like it does for the other frameworks.
 */
function tc39Effect(fn: () => void): void {
  const c = new Signal.Computed(fn);
  watcher.watch(c);
  c.get();
}

export const tc39Framework: ReactiveFramework = {
  name: 'TC39 Signals',
  signal: tc39Signal,
  computed: tc39Computed,
  effect: tc39Effect,
  withBatch: <T>(fn: () => T): T => {
    try {
      return fn();
    } finally {
      flushPendingEffects();
    }
  },
  withBuild: (fn) => fn(),
};
