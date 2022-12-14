// import type { Derived } from './derived.js';
// import { createEffect } from './effect.js';
// import { createSignal, Signal } from './signal.js';
// import { markUpdate, markDependency, DIRTY } from './state.js';
// import type { ReactiveValue } from './types.js';

// type Fetcher<ValueType> = (source: true) => Promise<ValueType>;
// type FetcherWithSource<SourceType, ValueType> = (source: SourceType) => Promise<ValueType>;

// export class Resource<ValueType> {
//   private fetcher: Fetcher<ValueType>;
//   loading = createSignal(false);
//   error: Signal<unknown> = createSignal();
//   sources: Array<Signal<unknown> | Derived<unknown>> | null = null;

//   last?: ValueType | undefined;

//   current?: ValueType | undefined;

//   constructor(fetcher: Fetcher<ValueType>) {
//     this.fetcher = fetcher;
//     this.fetch();
//   }

//   private async fetch() {
//     this.loading.value = true;

//     try {
//       // We always want to go ahead and update the previous state, so that we always end up
//       // with both the previous result (if any) *and* the new value *or* error, and never
//       // end up just throwing away data.
//       this.last = this.current;
//       this.current = await this.fetcher(true);
//       markUpdate(this, DIRTY);
//     } catch (err: unknown) {
//       this.error.value = err;
//     } finally {
//       this.loading.value = false;
//     }
//   }

//   get value() {
//     markDependency(this);
//     return this.current;
//   }
// }

// export class ResourceWithSignal<ValueType, SourceType> {
//   private fetcher: FetcherWithSource<SourceType, ValueType>;
//   loading = createSignal(false);
//   error: Signal<unknown> = createSignal();
//   sources: Array<Signal<unknown> | Derived<unknown>> | null = null;

//   last?: ValueType | undefined;
//   current?: ValueType | undefined;

//   constructor(
//     source: ReactiveValue<SourceType>,
//     fetcher: FetcherWithSource<SourceType, ValueType>
//   ) {
//     this.fetcher = fetcher;
//     createEffect(() => {
//       const value = source.value;
//       if (value === false || value === null || value === undefined) {
//         return;
//       }
//       this.fetch(value);
//     });
//   }

//   private async fetch(source: SourceType) {
//     this.loading.value = true;

//     try {
//       // We always want to go ahead and update the previous state, so that we always end up
//       // with both the previous result (if any) *and* the new value *or* error, and never
//       // end up just throwing away data.
//       this.last = this.current;
//       this.current = await this.fetcher(source);
//       markUpdate(this, DIRTY);
//     } catch (err) {
//       this.error.value = err;
//     } finally {
//       this.loading.value = false;
//     }
//   }

//   get value() {
//     markDependency(this);
//     return this.current;
//   }
// }

// export function createResource<ValueType>(fetcher: Fetcher<ValueType>): Resource<ValueType>;
// export function createResource<ValueType, SourceType>(
//   source: ReactiveValue<SourceType>,
//   fetcher: FetcherWithSource<SourceType, ValueType>
// ): ResourceWithSignal<ValueType, SourceType>;
// export function createResource<ValueType, SourceType>(
//   sourceOrFetcher: ReactiveValue<SourceType> | Fetcher<ValueType>,
//   fetcher?: FetcherWithSource<SourceType, ValueType>
// ): ResourceWithSignal<ValueType, SourceType> | Resource<ValueType> {
//   if (typeof sourceOrFetcher === 'function') {
//     return new Resource<ValueType>(sourceOrFetcher);
//   } else {
//     if (!fetcher || !(typeof fetcher === 'function')) {
//       throw new Error('You must pass a fetcher function when creating a Resource.');
//     }
//     return new ResourceWithSignal<ValueType, SourceType>(sourceOrFetcher, fetcher);
//   }
// }
