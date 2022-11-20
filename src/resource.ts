import { createEffect } from './effect';
import { createSignal, type Signal } from './signal';
import { createTag, markDependency, markUpdate, type Tag } from './tag';
import type { ReactiveValue } from './types';

type Fetcher<ValueType> = (source: true) => Promise<ValueType>;
type FetcherWithSource<SourceType, ValueType> = (source: SourceType) => Promise<ValueType>;

export class Resource<ValueType> {
  private fetcher: Fetcher<ValueType>;
  private tag: Tag;
  loading = createSignal(false);
  error: Signal<any> = createSignal();

  last?: ValueType | undefined;

  current?: ValueType | undefined;

  constructor(fetcher: Fetcher<ValueType>) {
    this.fetcher = fetcher;

    this.tag = createTag();

    this.fetch();
  }

  private async fetch() {
    this.loading.value = true;

    try {
      this.last = this.current;
      this.current = await this.fetcher(true);
      markUpdate(this.tag);
    } catch (err: any) {
      this.error.value = err;
    } finally {
      this.loading.value = false;
    }
  }

  get value() {
    markDependency(this.tag);
    return this.current;
  }
}

export class ResourceWithSignal<ValueType, SourceType> {
  private fetcher: FetcherWithSource<SourceType, ValueType>;
  private source: ReactiveValue<SourceType>;
  private tag: Tag;
  loading = createSignal(false);
  error: Signal<any> = createSignal();

  last?: ValueType | undefined;

  current?: ValueType | undefined;

  constructor(
    source: ReactiveValue<SourceType>,
    fetcher: FetcherWithSource<SourceType, ValueType>
  ) {
    this.fetcher = fetcher;
    this.source = source;
    this.tag = createTag();
    createEffect(() => {
      const value = this.source.value;
      if (value === false || value === null || value === undefined) {
        return;
      }
      this.fetch(value);
    }, [this.source]);
  }

  private async fetch(source: SourceType) {
    this.loading.value = true;

    try {
      this.last = this.current;
      this.current = await this.fetcher(source);
      markUpdate(this.tag);
    } catch (err) {
      this.error.value = err;
    } finally {
      this.loading.value = false;
    }
  }

  get value() {
    markDependency(this.tag);
    return this.current;
  }
}

export function createResource<ValueType>(fetcher: Fetcher<ValueType>): Resource<ValueType>;
export function createResource<ValueType, SourceType>(
  source: ReactiveValue<SourceType>,
  fetcher: FetcherWithSource<SourceType, ValueType>
): ResourceWithSignal<ValueType, SourceType>;
export function createResource<ValueType, SourceType>(
  sourceOrFetcher: ReactiveValue<SourceType> | Fetcher<ValueType>,
  fetcher?: FetcherWithSource<SourceType, ValueType>
): ResourceWithSignal<ValueType, SourceType> | Resource<ValueType> {
  if (typeof sourceOrFetcher === 'function') {
    return new Resource<ValueType>(sourceOrFetcher);
  } else {
    if (!fetcher || !(typeof fetcher === 'function')) {
      throw new Error('You must pass a fetcher function when creating a Resource.');
    }
    return new ResourceWithSignal<ValueType, SourceType>(sourceOrFetcher, fetcher);
  }
}
