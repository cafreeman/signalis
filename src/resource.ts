import { createEffect } from './effect';
import { createSignal } from './signal';
import { createTag, markDependency, markUpdate } from './tag';
import type { ReactiveValue } from './types';

type Fetcher<ValueType> = (source: true) => Promise<ValueType>;
type FetcherWithSource<SourceType, ValueType> = (source: SourceType) => Promise<ValueType>;

// These effectively do what `const enum` does, but doing it manually so we are not coupled to
// use `tsc` itself to build them. Additionally, though, we only allocate a single array per
// `Resource`, and reuse its memory when transitioning states. It would be nice if we could
// make *that* operation safe, but at least this way it is isolated to these "constructors"
// and the usage can be type safe.
const INITIAL_TAG = 0;
const LOADING_TAG = 1;
const LOADED_TAG = 2;
const ERROR_TAG = 3;

type Initial = [typeof INITIAL_TAG];
const Initial = (): Initial => [INITIAL_TAG];

type Loading = [typeof LOADING_TAG];
const Loading = <T>(state: State<T>): Loading => {
  state[0] = LOADING_TAG;
  state[1] = undefined;
  return state as Loading;
};

type Loaded<T> = [typeof LOADED_TAG, T];
const Loaded = <T>(state: State<T>, value: T): Loaded<T> => {
  state[0] = LOADED_TAG;
  state[1] = value;
  return state as Loaded<T>;
};

type Failed = [typeof ERROR_TAG, unknown];
const Failed = <T>(state: State<T>, err: unknown): Failed => {
  state[0] = ERROR_TAG;
  state[1] = err;
  return state as Failed;
};

type State<T> = Initial | Loading | Loaded<T> | Failed;

export class Resource<ValueType> {
  private fetcher: Fetcher<ValueType>;
  private tag = createTag();
  private state = createSignal<State<ValueType>>(Initial());

  get loading(): boolean {
    return this.state.value[0] === LOADING_TAG;
  }

  get error(): unknown {
    // The check is important so we never return the value for a loaded case!
    return this.state.value[0] === ERROR_TAG ? this.state.value[1] : undefined;
  }

  last?: ValueType | undefined;

  get current(): ValueType | undefined {
    return this.state.value[0] === LOADED_TAG ? this.state.value[1] : undefined;
  }

  constructor(fetcher: Fetcher<ValueType>) {
    this.fetcher = fetcher;
    this.fetch();
  }

  private async fetch() {
    this.state.value = Loading(this.state.value);

    try {
      // We always want to go ahead and update the previous state, so that we always end up
      // with both the previous result (if any) *and* the new value *or* error, and never
      // end up just throwing away data.
      this.last = this.current;
      const value = await this.fetcher(true);
      this.state.value = Loaded(this.state.value, value);
      markUpdate(this.tag);
    } catch (err: unknown) {
      this.state.value = Failed(this.state.value, err);
    }
  }

  get value() {
    markDependency(this.tag);
    return this.current;
  }
}

export class ResourceWithSignal<ValueType, SourceType> {
  private fetcher: FetcherWithSource<SourceType, ValueType>;
  private tag = createTag();
  private state = createSignal<State<ValueType>>(Initial());

  get loading(): boolean {
    return this.state.value[0] === LOADING_TAG;
  }

  get error(): unknown {
    // The check is important so we never return the value for a loaded case!
    return this.state.value[0] === ERROR_TAG ? this.state.value[1] : undefined;
  }

  last?: ValueType | undefined;

  get current(): ValueType | undefined {
    return this.state.value[0] === LOADED_TAG ? this.state.value[1] : undefined;
  }

  constructor(
    source: ReactiveValue<SourceType>,
    fetcher: FetcherWithSource<SourceType, ValueType>
  ) {
    this.fetcher = fetcher;
    createEffect(() => {
      const value = source.value;
      if (value === false || value === null || value === undefined) {
        console.log('bail!');
        return;
      }
      this.fetch(value);
    }, [source]);
  }

  private async fetch(source: SourceType) {
    this.state.value = Loading(this.state.value);

    try {
      // We always want to go ahead and update the previous state, so that we always end up
      // with both the previous result (if any) *and* the new value *or* error, and never
      // end up just throwing away data.
      this.last = this.current;
      const value = await this.fetcher(source);
      this.state.value = Loaded(this.state.value, value);
      markUpdate(this.tag);
    } catch (err) {
      this.state.value = Failed(this.state.value, err);
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
