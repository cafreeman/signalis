/** interface for a reactive framework.
 *
 * Implement this interface to add a new reactive framework to the benchmark suite. Each adapter
 * wraps the primitives of one library: mutable signals, lazy computed values, effects that
 * observe leaves, a batching wrapper for grouped writes, and a build wrapper for setup that
 * needs a disposal context (e.g. solid's `createRoot`).
 */
export interface ReactiveFramework {
  name: string;
  signal<T>(initialValue: T): Signal<T>;
  computed<T>(fn: () => T): Computed<T>;
  effect(fn: () => void): void;
  /** run `fn` as one batch; the harness ignores its result, so adapters needn't return it */
  withBatch(fn: () => void): void;
  withBuild<T>(fn: () => T): T;
}

export interface Signal<T> {
  read(): T;
  write(v: T): void;
}

export interface Computed<T> {
  read(): T;
}
