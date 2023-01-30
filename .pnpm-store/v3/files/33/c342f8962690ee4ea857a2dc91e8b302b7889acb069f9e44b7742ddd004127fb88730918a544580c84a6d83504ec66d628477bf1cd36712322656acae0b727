# @data-eden/network

## Features

- **fetch-compatible** Create a middleware-enabled `fetch` with the same API as [`window.fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), compatible with anything that understands `fetch`.
- **request & response aware** Supports middlewares for observing or altering requests or responses, alone or together.
- **streaming-compatible** Adds middleware support without eager body consumption, so can be used with streaming, as long as your middlewares are written to be streaming-aware.
- **composable** Middleware can be composible (e.g. you can author a middleware _in terms_ of other middlewares)

### Example use Cases

- **CSRF Injection** - add a CSRF header before every request
- **Query Tuneling** - seamlessly encode requests with long URLs as `POST` requests
- **Analytics** - send client-analytics for request,response pairs
- **Response Transformation** - seamlessly transform responses, e.g. for compatibility

## API

```typescript
export type Middleware = (request: Request, next: (request: Request) => Promise<Response>) : Promise<Response>;

export interface BuildFetchOptions {
  // Whether to force earlier built fetches to error making the most recent //
  // invokation the authoritive fetch. You will typically only want to set this to
  // false for testing. Defaults to true.
  disablePrior?: boolean;
  // What message to throw if a user tries to invoke a disabled fetch. Useful
  // to help users know where to import fetch from rather than build it //
  // themselves.
  disableMessage?: string;
}

export function buildFetch(
  middlewares: Middleware[],
  options?: BuildFetchOptions
): typeof fetch;
```

## Middleware Examples

```typescript
type Fetch = typeof fetch;

async function noopMiddleware(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  return next(request);
}

async function csrfMiddleware(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  request.headers.set('X-CSRF', 'a totally legit request');

  return next(request);
}

// e.g. fetch('https://example.com?foo=1&bar=two
async function queryTunneling(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  if (request.url.length <= MaxURLLength) {
    // no tunneling needed
    return next(request);
  }

  let url = new URL(request.url);
  request.headers.set('X-HTTP-Method-Override', request.method);
  let tunneledRequest = new Request(
    `${url.protocol}//${url.hostname}${url.pathname}`,
    {
      method: 'POST',
      headers: request.headers,
      body: url.searchParams,
    }
  );

  return next(tunneledRequest);
}

async function analyticsMiddleware(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  let response = await next(request);

  let requestHeaders = [...request.headers.keys()];
  let responseHeaders = [...response.headers.keys()];
  let status = response.status;
  let contentType = response.headers.get('content-type'); // Headers.get is case-insensitive
  let analyticsEntries = [];
  if (/^application\/json/.test(contentType)) {
    // Response.clone exists to handle this kind of use case
    let responseJson = await response.clone().json();
    if (responseJson.has_interesting_property) {
      analyticsEntries.push('interesting');
    }
  }

  scheduleAnalytics({
    requestHeaders,
    responseHeaders,
    status,
    analyticsEntries,
  });

  return response;
}

async function batchCreateEmbedResource(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  if (/target\/url\/pattern/.test(request.url)) {
    // Only transform certain kinds of requests
    return next(request);
  }

  let stashedRequest = request.clone();
  let rawResponse = await next(request);

  let contentType = rawResponse.headers.get('content-type');
  if (!/^application\/json/.test(contentType)) {
    // Only transform JSON responses
    return rawResponse;
  }

  let transformedResponse = rawResponse.clone();
  // also overwrite .text &c. or return a Proxy to avoid cloning.
  transformedResponse.json = async function () {
    // Read the requested body from a cloned request as request bodies can only be read once
    let requestBody = await stashedRequest.json();
    // Read the response lazily. This implementation does not handle
    let responseBody = await rawResponse.json();

    for (let i = 0; i < responseBody.elements.length; ++i) {
      // combine the request and response bodies for downstream users.
      responseBody.elements[i].resource = requestBody.elements[i];
    }
  };

  return transformedResponse;
}

async function badMiddleware(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  let response = await next(request);

  // ⛔ Error! ⛔ Don't do this -- it interferes with streaming responses as
  // well as subsequent middlewares
  //
  // use response.clone() to read the body from a middleware
  let responseJson = await response.json();
  if (responseJson.something) {
    // do something...
  }

  return response;
}
```

## Middleware Composition

Composing middleware is as easy as composing normal functions.

```typescript
// Use another middleware conditionally (e.g. only for `/api` requests)
async function limitedAnalytics(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  if (request.url.startsWith('/api')) {
    return await analyticsMiddleware(request, fetch);
  }

  return next(request);
}
```

## Fetch Usage

```typescript
// Creating and invoking a middleware-enabled fetch
import { buildFetch } from '@data-eden/network';

let fetch = buildFetch([
  csrfMiddleware,
  queryTunneling,
  limitedAnalytics,
  batchCreateEbmedResource,
]);

await fetch('///api');

let response = await fetch('/my-api');
```

## Middleware Configuration

There are two patterns for configuring middleware:

- Factory functions
- Middleware HTTP headers

If your middleware has setup-time configuration, use a factory function:

```typescript
export function buildAnalyticsMiddleware(analyticsUrl) {
  return new async (
    request: Request,
    next: (request: Request) => Promise<Response>
  ) => {
    // ...
    let analytics = extractAnalytics(request);
    scheduleAnalytics(analyticsUrl, analytics);

    return next(request);
  }
};
```

If your middleware requires per-request user configuration, you can use custom
HTTP headers as a means of communicating from the user's `fetch` call to your
middleware. If needed, your middleware can transform these headers to provide
better APIs to your users than what your server may allow.

```typescript
async function analyticsMiddleware(
  request: Request,
  next: (request: Request) => Promise<Response>
): Promise<Response> {
  let useCase = request.headers.get('X-Use-Case');
  if(useCase !== undefined) {
    request.headers.delete('X-Use-Case');
    request.headers.set('X-Server-Header-Tracking-abc123': useCase);
  }

  return next(request);
}
```

For highly configurable middlewares these techniques can be combined.

## Prior Art

- [fetch-wrap](https://github.com/benjamine/fetch-wrap)
- [node-fetch-middleware](https://github.com/lev-kuznetsov/node-fetch-middleware)
