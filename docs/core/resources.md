# Resources

A `Resource` is a reactive abstraction for working with asynchronous values. Resources provide built-in loading and error states, making it easy to integrate async data into your reactive systems.

## Key Characteristics

- **Async-first**: Designed specifically for Promise-based operations
- **Loading states**: Automatic `loading` signal
- **Error handling**: Built-in `error` signal
- **Refetchable**: Easy to trigger data refetching
- **Reactive sources**: Can depend on other reactive values

## Creating Resources

### Standalone Resource

For async operations that don't depend on reactive values:

```typescript
import { createResource } from '@signalis/core';

const postResource = createResource(() =>
  fetch('https://api.example.com/post').then((res) => res.json()),
);

// Check loading state
if (postResource.loading.value) {
  console.log('Loading...');
}

// Check for errors
if (postResource.error.value) {
  console.error('Error:', postResource.error.value);
}

// Access the data
if (postResource.value) {
  console.log('Post:', postResource.value);
}

// Refetch the data
postResource.refetch();
```

### Resource with Source

For async operations that depend on reactive values. The resource will only fetch when the source is truthy, allowing you to delay fetching until you have the required data:

```typescript
import { createSignal, createResource } from '@signalis/core';

const pageNumber = createSignal<number | null>(null);

const postResource = createResource(pageNumber, (page) =>
  fetch(`https://api.example.com/posts/${page}`).then((res) => res.json()),
);

// No request happens yet (pageNumber is null)

pageNumber.value = 1;
// Now the fetcher runs with page=1

pageNumber.value = 2;
// Fetcher runs again with page=2
```

## API Reference

### `createResource<ValueType>(fetcher: () => Promise<ValueType>): Resource<ValueType>`

Creates a standalone resource that fetches immediately.

**Parameters:**

- `fetcher`: An async function that returns a Promise

**Returns:** A `Resource<ValueType>` with:

- `value`: `ValueType | undefined` - The fetched data
- `last`: `ValueType | undefined` - Previous value (for optimistic updates)
- `loading`: `Signal<boolean>` - Loading state
- `error`: `Signal<unknown>` - Error state
- `refetch()`: Function to trigger a new fetch

### `createResource<SourceType, ValueType>(source: Signal<SourceType> | Derived<SourceType>, fetcher: (source: SourceType) => Promise<ValueType>): ResourceWithSource<ValueType, SourceType>`

Creates a resource that depends on a reactive source value.

**Parameters:**

- `source`: A signal or derived value to watch
- `fetcher`: An async function that receives the source value

**Returns:** A `ResourceWithSource<ValueType, SourceType>` with the same properties as `Resource`

**Note:** The fetcher only runs when the source is truthy (not `null`, `undefined`, or `false`).

## Resource State

A resource exposes four pieces of state:

### `value: ValueType | undefined`

The most recent successfully fetched value.

```typescript
const data = createResource(() => fetchData());

if (data.value) {
  console.log('Data:', data.value);
}
```

### `last: ValueType | undefined`

The previous value before the current fetch. Useful for showing stale data while fetching:

```typescript
if (data.loading.value && data.last) {
  console.log('Showing old data:', data.last);
} else if (data.value) {
  console.log('Showing current data:', data.value);
}
```

### `loading: Signal<boolean>`

Whether the resource is currently fetching.

```typescript
if (data.loading.value) {
  showSpinner();
} else {
  hideSpinner();
}
```

### `error: Signal<unknown>`

Contains any error thrown during fetching.

```typescript
if (data.error.value) {
  console.error('Failed to fetch:', data.error.value);
}
```

## Common Patterns

### REST API Calls

```typescript
const userId = createSignal<number | null>(null);

const userResource = createResource(userId, (id) =>
  fetch(`/api/users/${id}`).then((res) => res.json()),
);

// Later
userId.value = 123; // Triggers fetch
```

### Pagination

```typescript
const page = createSignal(1);
const pageSize = createSignal(10);

// Combine multiple signals using a derived value
const params = createDerived(() => ({
  page: page.value,
  pageSize: pageSize.value,
}));

const paginatedData = createResource(params, ({ page, pageSize }) =>
  fetch(`/api/items?page=${page}&pageSize=${pageSize}`).then((res) => res.json()),
);

const nextPage = () => page.value++;
const prevPage = () => page.value--;
```

### Dependent Fetching

```typescript
const userId = createSignal<number | null>(null);

const userResource = createResource(userId, (id) =>
  fetch(`/api/users/${id}`).then((res) => res.json()),
);

// Fetch user's posts once we have user data
const postsResource = createResource(
  createDerived(() => userResource.value?.id),
  (userId) => fetch(`/api/users/${userId}/posts`).then((res) => res.json()),
);
```

### With Loading and Error UI

```typescript
import { createEffect } from '@signalis/core';

const data = createResource(() => fetchData());
const { loading, error } = data;

createEffect(() => {
  if (loading.value) {
    renderLoading();
  } else if (error.value) {
    renderError(error.value);
  } else if (data.value) {
    renderData(data.value);
  }
});
```

### Manual Refetch

**Note:** Only standalone resources (without sources) support manual refetching.

```typescript
const data = createResource(() => fetchData());

// Trigger based on user action
button.addEventListener('click', () => {
  data.refetch();
});

// Trigger based on signal change
const refreshTrigger = createSignal();

createEffect(() => {
  refreshTrigger.value; // Create dependency
  data.refetch();
});
```

For resources with sources, you can trigger refetching by updating the source value:

```typescript
const userId = createSignal(1);
const userResource = createResource(userId, fetchUser);

// Trigger refetch by updating the source
userId.value = 2; // This will refetch with the new user ID
```

### Polling

```typescript
const data = createResource(() => fetchData());

// Poll every 5 seconds
const interval = setInterval(() => {
  data.refetch();
}, 5000);

// Cleanup
clearInterval(interval);
```

### Optimistic Updates

```typescript
const itemId = createSignal(1);
const itemResource = createResource(itemId, (id) =>
  fetch(`/api/items/${id}`).then((res) => res.json()),
);

function updateItem(newData: any) {
  // Show optimistic update using last value
  if (itemResource.last) {
    renderItem({ ...itemResource.last, ...newData });
  }

  // Trigger actual update
  fetch(`/api/items/${itemId.value}`, {
    method: 'PATCH',
    body: JSON.stringify(newData),
  }).then(() => {
    itemResource.refetch();
  });
}
```

## Error Handling

Resources automatically catch errors and store them in the `error` signal:

```typescript
const data = createResource(async () => {
  const res = await fetch('/api/data');

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  return res.json();
});

createEffect(() => {
  if (data.error.value) {
    console.error('Failed to fetch:', data.error.value);
    showErrorMessage(data.error.value);
  }
});
```

## Preventing Stale Updates

When a resource depends on a changing value, previous requests might complete after newer ones:

```typescript
const searchQuery = createSignal('');

let currentRequest = 0;

const searchResource = createResource(searchQuery, async (query) => {
  const requestId = ++currentRequest;
  const results = await searchAPI(query);

  // Only return if this is still the latest request
  if (requestId === currentRequest) {
    return results;
  }
});
```

## Gotchas

### Source Must Be Truthy

Resources with sources only fetch when the source is truthy. This allows you to delay fetching until you have the data you need:

```typescript
const userId = createSignal<number | null>(null);
const user = createResource(userId, fetchUser);

// No fetch happens (userId is null)

userId.value = 0; // Still no fetch! (0 is falsy)

userId.value = 1; // Now it fetches
```

This pattern is useful for:

- **Conditional fetching**: Only fetch when you have required parameters
- **User-triggered loading**: Wait for user input before making requests
- **Dependent data**: Fetch data only after prerequisite data is available

### Refetch Doesn't Reset Errors

You may want to manually clear errors before refetching:

```typescript
function retryFetch() {
  data.error.value = undefined;
  data.refetch();
}
```

## See Also

- [Signals](/core/signals) - Understanding the underlying signal type
- [Effects](/core/effects) - Responding to resource state changes
- [Derived](/core/derived) - Creating complex source dependencies
- [Examples](/examples/async-data) - Complete async data example
