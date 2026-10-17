import { computed, effect, ref } from '@vue/reactivity';
import type { Computed, ReactiveFramework, Signal } from '../ReactiveFramework.js';

function vueSignal<T>(initialValue: T): Signal<T> {
  const r = ref(initialValue);
  return {
    write: (v: T) => (r.value = v),
    read: (): T => r.value,
  };
}

function vueComputed<T>(fn: () => T): Computed<T> {
  const c = computed(fn);
  return {
    read: (): T => c.value,
  };
}

function vueEffect(fn: () => void): void {
  // the standalone @vue/reactivity effect runs its callback immediately and synchronously on
  // dependency change; it returns a runner with a `stop` method, which the benchmark doesn't need
  effect(fn);
}

export const vueFramework: ReactiveFramework = {
  name: 'Vue Reactivity',
  signal: vueSignal,
  computed: vueComputed,
  effect: vueEffect,
  // vue has no batch primitive: effects run synchronously as writes happen
  withBatch: (fn) => fn(),
  withBuild: (fn) => fn(),
};
