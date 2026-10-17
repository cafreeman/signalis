import { createEffect, createMemo, createRoot, createSignal, flush } from '@solidjs/signals';
import type { Computed, ReactiveFramework, Signal } from '../ReactiveFramework.js';

function solidSignal<T>(initialValue: T): Signal<T> {
  // solid's signal values can't be functions; the benchmark only stores numbers
  const [get, set] = createSignal(initialValue as Exclude<T, Function>);
  return {
    read: get,
    write: (v: T) => set(v as Exclude<T, Function>),
  };
}

// memos are eager: they refresh on write even when nothing reads them, so solid runs more
// computeds than the lazy engines on partial-read scenarios (see TestConfigs.ts)
function solidComputed<T>(fn: () => T): Computed<T> {
  const memo = createMemo(() => fn());
  return {
    read: memo,
  };
}

function solidEffect(fn: () => void): void {
  // solid 2.0 splits effects into a tracked compute phase and an untracked effect phase; the
  // compute phase here plays the same role as the tracked effect callbacks of the other adapters
  createEffect(
    () => fn(),
    () => {},
  );
}

export const solidFramework: ReactiveFramework = {
  name: 'Solid 2.0',
  signal: solidSignal,
  computed: solidComputed,
  effect: solidEffect,
  // flush(fn) runs the callback and then drains pending effects at the batch boundary
  withBatch: flush,
  withBuild: createRoot,
};
