import { buildCache } from '@data-eden/cache';
import { buildFetch } from '@data-eden/network';
import { createSignal } from '@signalis/core';

async function loggerMiddleware(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  console.log('request happening!');
  return next(request);
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if ('url' in input) {
    return input.url;
  }

  return input.toString();
}

const SIGNAL = Symbol('data-eden-signal');

function createHandler(): ProxyHandler<any> {
  return {
    get(target, prop, receiver) {
      const result = Reflect.get(target, prop, receiver);
      if (prop !== SIGNAL) {
        target[SIGNAL].value;
      }

      return result;
    },
    set(target, prop, value) {
      const result = Reflect.set(target, prop, value);
      if (prop !== SIGNAL) {
        const s = target[SIGNAL];
        s.value = s.value + 1;
      }

      return result;
    },
  };
}

export function buildCachedFetch() {
  const fetch = buildFetch([loggerMiddleware]);
  const cache = buildCache();

  const SignalCache = new Map<string, any>();
  const handler = createHandler();

  return async function (input: RequestInfo | URL, init?: RequestInit | undefined) {
    const key = getUrl(input);

    const res = await fetch(input, init).then((res) => res.json());

    const tx = await cache.beginTransaction();
    tx.set(key, res);
    await tx.commit();

    const cacheResult = await cache.get(key);

    let withSignal = SignalCache.get(key);

    if (withSignal === undefined) {
      const base = {
        ...cacheResult,
        [SIGNAL]: createSignal(0),
      };
      withSignal = new Proxy(base, handler);
      // withSignal = createSignal(cacheResult);
      SignalCache.set(key, withSignal);
    } else {
      Object.assign(withSignal, cacheResult);
      // withSignal.value = cacheResult;
    }

    return withSignal;
  };
}
