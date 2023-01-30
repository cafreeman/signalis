export type Fetch = typeof fetch;

export type NormalizedFetch = (request: Request) => Promise<Response>;

export type Middleware = (
  /**
   * Request object to be manipulated by middleware
   */
  request: Request,
  /**
   * localized fetch used when all middlewares are done with manipulating Request
   */
  next: NormalizedFetch
) => Promise<Response>;

export interface BuildFetchOptions {
  /**
   * Whether to force earlier built fetches to error making the most recent //
   * invokation the authoritive fetch. You will typically only want to set this to
   * false for testing. Defaults to true.
   */
  disablePrior?: boolean;
  /**
   * What message to throw if a user tries to invoke a disabled fetch. Useful
   * to help users know where to import fetch from rather than build it //
   * themselves.
   */
  disableMessage?: string;
  /**
   * override the default fetch implementation
   */
  fetch: Fetch;
}

function combine(
  next: NormalizedFetch,
  middleware: Middleware
): NormalizedFetch {
  return async (request: Request) => {
    return middleware(request, next);
  };
}

function globalFetch(request: Request): Promise<Response> {
  return fetch(request);
}

/**
 *
 * @param middlewares {Middleware[]} array of middlewares
 * @param options {BuildFetchOptions=} optional options for overriding buildFetch configuration
 * @returns Fetch
 */
export function buildFetch(
  middlewares: Middleware[],
  options?: BuildFetchOptions
): Fetch {
  if (typeof fetch === 'undefined') {
    throw new Error(
      "@data-eden/network requires `fetch` to be available on`globalThis`. Did you forget to setup `cross-fetch/polyfill` before calling @data-eden/network's `buildFetch`?"
    );
  }
  const _fetch: NormalizedFetch = options?.fetch || globalFetch;

  const curriedMiddlewares: NormalizedFetch = [...middlewares]
    .reverse()
    .reduce(combine, _fetch);

  return async (rawRequest: RequestInfo | URL, init?: RequestInit) => {
    const normalizedRequest = new Request(rawRequest, init);
    return curriedMiddlewares(normalizedRequest);
  };
}
