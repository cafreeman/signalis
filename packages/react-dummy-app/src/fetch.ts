import { buildCache } from '@data-eden/cache';
import { buildFetch } from '@data-eden/network';
import { createSignal } from '@signalis/core';

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if ('url' in input) {
    return input.url;
  }

  return input.toString();
}

function createHandler(): ProxyHandler<any> {
  return {
    get(target, prop, receiver) {
      const value = target.value;
      const result = Reflect.get(value, prop, receiver);
      return result;
    },

    set(target, prop, value) {
      const innerValue = target.value;
      const result = Reflect.set(innerValue, prop, value);
      // shallow clone to trigger signal update based on reference equality. we can improve this in the future
      target.value = innerValue;
      return result;
    },
  };
}

export function buildCachedFetch() {
  const SignalCache = new Map<string, any>();

  const fetch = buildFetch([]);

  const cache = buildCache({
    hooks: {
      async commit(tx) {
        for await (const entry of tx.entries()) {
          const [key, entity] = entry;
          let withSignal = SignalCache.get(key);

          // Entity can also be string | number so we need to make sure it's actually an object here
          if (entity !== null && typeof entity === 'object') {
            if (withSignal === undefined) {
              withSignal = new Proxy(createSignal(entity, false), handler);

              SignalCache.set(key, withSignal);
            } else {
              Object.assign(withSignal, entity);
            }
          }
        }
      },
    },
  });

  const handler = createHandler();

  return async function (input: RequestInfo | URL, init?: RequestInit | undefined) {
    const key = getUrl(input);
    const res = await fetch(input, init).then((res) => res.json());

    const tx = await cache.beginTransaction();
    tx.set(key, res);
    await tx.commit();

    return SignalCache.get(key);
  };
}
