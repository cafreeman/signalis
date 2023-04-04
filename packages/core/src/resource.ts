import { createEffect } from './effect.js';
import { createSignal, type Signal } from './signal.js';
import type { ReactiveValue } from './types.js';
import { untrack } from './untrack.js';

type Fetcher<ValueType> = () => Promise<ValueType>;
type FetcherWithSource<SourceType, ValueType> = (source: SourceType) => Promise<ValueType>;

export class Resource<ValueType> {
  private fetcher: Fetcher<ValueType>;
  loading = createSignal(false);
  error: Signal<unknown> = createSignal();

  last?: ValueType | undefined;
  current = createSignal<ValueType | undefined>(undefined);

  constructor(fetcher: Fetcher<ValueType>) {
    this.fetcher = fetcher;
    this.fetch();
  }

  get value() {
    return this.current.value;
  }

  private async fetch() {
    this.loading.value = true;

    try {
      // We always want to go ahead and update the previous state, so that we always end up
      // with both the previous result (if any) *and* the new value *or* error, and never
      // end up just throwing away data.
      this.last = untrack(() => this.current.value);
      this.current.value = await this.fetcher();
    } catch (err: unknown) {
      this.error.value = err;
    } finally {
      this.loading.value = false;
    }
  }

  refetch() {
    this.fetch();
  }
}

export class ResourceWithSource<ValueType, SourceType> {
  private fetcher: FetcherWithSource<SourceType, ValueType>;
  loading = createSignal(false);
  error: Signal<unknown> = createSignal();

  last?: ValueType | undefined;
  current = createSignal<ValueType | undefined>(undefined);

  constructor(
    source: ReactiveValue<SourceType>,
    fetcher: FetcherWithSource<SourceType, ValueType>
  ) {
    this.fetcher = fetcher;
    createEffect(() => {
      const value = source.value;
      if (value === false || value === null || value === undefined) {
        return;
      }
      this.fetch(value);
    });
  }

  private async fetch(source: SourceType) {
    this.loading.value = true;

    try {
      // We always want to go ahead and update the previous state, so that we always end up
      // with both the previous result (if any) *and* the new value *or* error, and never
      // end up just throwing away data.
      // We suspend tracking here so that we don't add the resource's value as a dependency to the
      // effect that calls `fetch`
      this.last = untrack(() => this.current.value);
      this.current.value = await this.fetcher(source);
    } catch (err) {
      this.error.value = err;
    } finally {
      this.loading.value = false;
    }
  }

  get value() {
    return this.current.value;
  }
}

export function createResource<ValueType>(fetcher: Fetcher<ValueType>): Resource<ValueType>;
export function createResource<SourceType, ValueType>(
  source: ReactiveValue<SourceType>,
  fetcher: FetcherWithSource<SourceType, ValueType>
): ResourceWithSource<ValueType, SourceType>;
export function createResource<SourceType, ValueType>(
  sourceOrFetcher: ReactiveValue<SourceType> | Fetcher<ValueType>,
  fetcher?: FetcherWithSource<SourceType, ValueType>
): ResourceWithSource<ValueType, SourceType> | Resource<ValueType> {
  if (typeof sourceOrFetcher === 'function') {
    return new Resource<ValueType>(sourceOrFetcher);
  } else {
    if (!fetcher || !(typeof fetcher === 'function')) {
      throw new Error('You must pass a fetcher function when creating a Resource.');
    }
    return new ResourceWithSource<ValueType, SourceType>(sourceOrFetcher, fetcher);
  }
}
