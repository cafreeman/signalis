import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  expect,
  test,
  describe,
} from 'vitest';
import * as http from 'http';

import { buildFetch, Middleware, NormalizedFetch } from '@data-eden/network';
import { createServer } from '@data-eden/shared-test-utilities';

function getPrefixedIncomingHttpHeaders(
  headers: http.IncomingHttpHeaders,
  prefix: string
): object {
  const result: Record<string, string | string[]> = {};

  for (const key in headers) {
    const value = headers[key];
    if (key.toLowerCase().startsWith(prefix.toLowerCase()) && value) {
      result[key] = value;
    }
  }

  return result;
}

function getPrefixedHeaders(headers: Headers, prefix: string): object {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of headers) {
    if (key.toLowerCase().startsWith(prefix.toLowerCase()) && value) {
      result[key] = value;
    }
  }

  return result;
}

describe('@data-eden/fetch', async function () {
  const server = await createServer();

  beforeAll(async () => await server.listen());
  beforeEach(() => {
    server.get(
      '/resource',
      (request: http.IncomingMessage, response: http.ServerResponse) => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            customOriginalRequestHeaders: getPrefixedIncomingHttpHeaders(
              request.headers,
              'X-'
            ),
            status: 'success',
          })
        );
      }
    ),
      server.post(
        '/resource/preview',
        (request: http.IncomingMessage, response: http.ServerResponse) => {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              method: request.method,
              customOriginalRequestHeaders: getPrefixedIncomingHttpHeaders(
                request.headers,
                'X-'
              ),
              status: 'success',
            })
          );
        }
      );

    server.get(
      '/analytics',
      (_request: http.IncomingMessage, response: http.ServerResponse) => {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'x-call-id': '1234567',
        });

        response.end(
          JSON.stringify({
            status: 'success',
          })
        );
      }
    );
  });

  afterEach(() => server.reset());
  afterAll(() => server.close());

  const noopMiddleware: Middleware = async (
    request: Request,
    next: NormalizedFetch
  ) => {
    return next(request);
  };

  const csrfMiddleware: Middleware = async (
    request: Request,
    next: NormalizedFetch
  ) => {
    request.headers.set('X-CSRF', 'a totally legit request');

    return next(request);
  };

  test('throws a helpful error when `fetch` is undefined', async () => {
    const originalFetch = globalThis.fetch;

    try {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any*/
      delete (globalThis as any).fetch;

      expect(() => {
        buildFetch([]);
      }).toThrowErrorMatchingInlineSnapshot(
        '"@data-eden/network requires `fetch` to be available on`globalThis`. Did you forget to setup `cross-fetch/polyfill` before calling @data-eden/network\'s `buildFetch`?"'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('should be able to return fetch without middlewares passed', async () => {
    expect.assertions(2);

    const fetch = buildFetch([]);

    const response = await fetch(server.buildUrl('/resource'));

    expect(response.status).toEqual(200);
    expect(await response.json()).toMatchInlineSnapshot(`
      {
        "customOriginalRequestHeaders": {},
        "status": "success",
      }
    `);
  });

  test('should be able to handle basic middleware', async () => {
    expect.assertions(2);

    const fetch = buildFetch([noopMiddleware, csrfMiddleware]);

    const response = await fetch(server.buildUrl('/resource'));

    expect(response.status).toEqual(200);
    expect(await response.json()).toMatchInlineSnapshot(`
      {
        "customOriginalRequestHeaders": {
          "x-csrf": "a totally legit request",
        },
        "status": "success",
      }
    `);
  });

  test('allows globalThis.fetch to be mocked per test (e.g. Pretender / MirageJS / msw style)', async () => {
    const fetch = buildFetch([]);

    let response = await fetch(server.buildUrl('/resource'));

    expect(await response.json(), 'precond - uses globalThis.fetch by default')
      .toMatchInlineSnapshot(`
      {
        "customOriginalRequestHeaders": {},
        "status": "success",
      }
    `);

    const originalFetch = globalThis.fetch;

    try {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any*/
      delete (globalThis as any).fetch;

      const customFetch = (
        _input: URL | RequestInfo,
        _init?: RequestInit
      ): Promise<Response> => {
        // does not call `next` at all, just resolves with some specific response
        return Promise.resolve(new Response('We overrode fetch!'));
      };

      // overrides the global `fetch` **after** `buildFetch` has been called
      globalThis.fetch = customFetch;

      response = await fetch(server.buildUrl('/resource'));

      expect(
        await response.text(),
        'overriden fetch was used'
      ).toMatchInlineSnapshot('"We overrode fetch!"');
    } finally {
      globalThis.fetch = originalFetch;
    }

    response = await fetch(server.buildUrl('/resource'));

    expect(
      response.status,
      'original fetch was used after globalThis.fetch was reset'
    ).toEqual(200);
  });

  test('should be able to override fetch', async () => {
    expect.assertions(1);

    const customFetch = (
      _input: URL | RequestInfo,
      _init?: RequestInit
    ): Promise<Response> => {
      return Promise.resolve(new Response('We overrode fetch!'));
    };

    const fetch = buildFetch([noopMiddleware], {
      fetch: customFetch,
    });

    const response = await fetch('https://www.example.com');

    expect(await response.text()).toMatchInlineSnapshot('"We overrode fetch!"');
  });

  test('can not change options.fetch lazily', async () => {
    const options = {
      fetch: (
        _input: URL | RequestInfo,
        _init?: RequestInit
      ): Promise<Response> => {
        return Promise.resolve(new Response('custom fetch here!'));
      },
    };
    const fetch = buildFetch([noopMiddleware], options);

    let response = await fetch(server.buildUrl('/resource'));
    expect(await response.text()).toMatchInlineSnapshot('"custom fetch here!"');

    options.fetch = (
      _input: URL | RequestInfo,
      _init?: RequestInit
    ): Promise<Response> => {
      return Promise.resolve(new Response('We overrode fetch!'));
    };

    response = await fetch(server.buildUrl('/resource'));
    expect(
      await response.text(),
      'overridden `options.fetch` is not used'
    ).toMatchInlineSnapshot('"custom fetch here!"');
  });

  test('should be able to change the http method for a given request', async () => {
    expect.assertions(2);

    const queryTunneling: Middleware = async (
      request: Request,
      next: NormalizedFetch
    ) => {
      if (request.url.length <= 10) {
        // no tunneling needed
        return next(request);
      }

      const url = new URL(request.url);
      request.headers.set('X-HTTP-Method-Override', request.method);
      const tunneledRequest = new Request(
        `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`,
        {
          method: 'POST',
          headers: request.headers,
          body: url.searchParams,
        }
      );

      return next(tunneledRequest);
    };

    const fetch = buildFetch([csrfMiddleware, queryTunneling, noopMiddleware]);

    const response = await fetch(server.buildUrl('/resource/preview'));

    expect(response.status).toEqual(200);
    expect(await response.json()).toMatchInlineSnapshot(`
      {
        "customOriginalRequestHeaders": {
          "x-csrf": "a totally legit request",
          "x-http-method-override": "GET",
        },
        "method": "POST",
        "status": "success",
      }
    `);
  });

  test('should be able to maintain order of middlewares passed', async () => {
    expect.assertions(5);

    const middlewareOne: Middleware = async (
      request: Request,
      next: NormalizedFetch
    ) => {
      expect(getPrefixedHeaders(request.headers, 'X-')).toMatchInlineSnapshot(
        '{}'
      );

      return next(request);
    };

    const middlewareTwo: Middleware = async (
      request: Request,
      next: NormalizedFetch
    ) => {
      expect(getPrefixedHeaders(request.headers, 'X-')).toMatchInlineSnapshot(
        '{}'
      );

      request.headers.set('x-two', 'true');

      return next(request);
    };

    const middlewareThree: Middleware = async (
      request: Request,
      next: NormalizedFetch
    ) => {
      expect(getPrefixedHeaders(request.headers, 'X-')).toMatchInlineSnapshot(`
        {
          "x-two": "true",
        }
      `);

      request.headers.set('x-three', 'true');

      return next(request);
    };

    const fetch = buildFetch([middlewareOne, middlewareTwo, middlewareThree]);

    const response = await fetch(server.buildUrl('/resource'));
    expect(response.status).toEqual(200);
    expect(await response.json()).toMatchInlineSnapshot(`
      {
        "customOriginalRequestHeaders": {
          "x-three": "true",
          "x-two": "true",
        },
        "status": "success",
      }
    `);
  });

  test('earlier middlewares can wrap the results of later middlewares', async () => {
    const steps: string[] = [];
    const a: Middleware = async (request: Request, next: NormalizedFetch) => {
      steps.push('a start');

      const result = await next(request);

      steps.push('a end');

      return result;
    };

    const b: Middleware = async (request: Request, next: NormalizedFetch) => {
      steps.push('b start');

      const result = await next(request);

      steps.push('b end');

      return result;
    };

    const c: Middleware = async (request: Request, next: NormalizedFetch) => {
      steps.push('c start');

      const result = await next(request);

      steps.push('c end');

      return result;
    };

    const fetch = buildFetch([a, b, c]);

    const response = await fetch(server.buildUrl('/resource'));

    expect(steps).toMatchInlineSnapshot(`
      [
        "a start",
        "b start",
        "c start",
        "c end",
        "b end",
        "a end",
      ]
    `);
    expect(response.status).toEqual(200);
  });

  test('should be able to introspect on the response as a middleware', async () => {
    expect.assertions(4);

    async function analyticsMiddleware(
      request: Request,
      next: (request: Request) => Promise<Response>
    ): Promise<Response> {
      const response = await next(request);

      expect(getPrefixedHeaders(response.headers, 'X-')).toMatchInlineSnapshot(`
        {
          "x-call-id": "1234567",
        }
      `);
      expect(response.status).toEqual(200);

      return response;
    }

    const fetch = buildFetch([analyticsMiddleware]);

    const response = await fetch(server.buildUrl('/analytics'));
    expect(response.status).toEqual(200);
    expect(await response.json()).toMatchInlineSnapshot(`
      {
        "status": "success",
      }
    `);
  });

  test('can read and mutate request headers', async function () {
    expect.assertions(2);

    server.get(
      '/foo',
      (request: http.IncomingMessage, response: http.ServerResponse) => {
        expect(getPrefixedIncomingHttpHeaders(request.headers, 'X-'))
          .toMatchInlineSnapshot(`
        {
          "x-track": "signup",
        }
      `);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            status: 'success',
          })
        );
      }
    );

    // A middleware might provide a header-based API (perhaps with sugar
    // functions) to let users annotate requests, e.g. for requests that should
    // be grouped according to a product use case.
    //
    // In the general case a middleware would need to be able to consume and
    // modify the headers as a way of providing a seamless API.
    async function headerTransformationMiddleware(
      request: Request,
      next: NormalizedFetch
    ): Promise<Response> {
      let useCaseAnnotation = request.headers.get('X-Use-Case');

      if (useCaseAnnotation) {
        request.headers.set('X-Track', useCaseAnnotation);
        request.headers.delete('X-Use-Case');
      }

      return next(request);
    }

    let fetch = buildFetch([headerTransformationMiddleware]);
    let response = await fetch(server.buildUrl('/foo'), {
      headers: { 'X-Use-Case': 'signup' },
    });

    expect(await response.json()).toMatchInlineSnapshot(`
      {
        "status": "success",
      }
    `);
  });
});
