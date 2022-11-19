import { createSignal, type Signal } from '../signal';

export class TrackedSet<T = unknown> implements Set<T> {
  private collection = createSignal(0);

  private storages: Map<T, Signal<number>> = new Map();

  private vals: Set<T>;

  private storageFor(key: T): Signal<number> {
    const storages = this.storages;
    let storage = storages.get(key);

    if (storage === undefined) {
      storage = createSignal(0);
      storages.set(key, storage);
    }

    return storage;
  }

  private dirtyStorageFor(key: T): void {
    const storage = this.storages.get(key);

    if (storage) {
      storage.value++;
    }
  }

  constructor();
  constructor(values: readonly T[] | null);
  constructor(iterable: Iterable<T>);
  constructor(existing?: readonly T[] | Iterable<T> | null | undefined) {
    this.vals = new Set(existing);
  }

  // **** KEY GETTERS ****
  has(value: T): boolean {
    this.storageFor(value).value;

    return this.vals.has(value);
  }

  // **** ALL GETTERS ****
  entries(): IterableIterator<[T, T]> {
    this.collection.value;

    return this.vals.entries();
  }

  keys(): IterableIterator<T> {
    this.collection.value;

    return this.vals.keys();
  }

  values(): IterableIterator<T> {
    this.collection.value;

    return this.vals.values();
  }

  forEach(fn: (value1: T, value2: T, set: Set<T>) => void): void {
    this.collection.value;

    this.vals.forEach(fn);
  }

  get size(): number {
    this.collection.value;

    return this.vals.size;
  }

  [Symbol.iterator](): IterableIterator<T> {
    this.collection.value;

    return this.vals[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return this.vals[Symbol.toStringTag];
  }

  // **** KEY SETTERS ****
  add(value: T): this {
    this.dirtyStorageFor(value);
    this.collection.value++;

    this.vals.add(value);

    return this;
  }

  delete(value: T): boolean {
    this.dirtyStorageFor(value);
    this.collection.value++;

    return this.vals.delete(value);
  }

  // **** ALL SETTERS ****
  clear(): void {
    this.storages.forEach((s) => s.value++);
    this.collection.value = 0;

    this.vals.clear();
  }
}

Object.setPrototypeOf(TrackedSet.prototype, Set.prototype);
