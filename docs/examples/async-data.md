# Async Data Example

Fetching and managing async data with resources, loading states, and error handling.

## Using Resources

```tsx
import { createSignal, createResource, reactor } from '@signalis/react';

interface Post {
  id: number;
  title: string;
  body: string;
}

const PostViewer = () => {
  const postId = createSignal<number | null>(null);

  // Resource automatically refetches when postId changes
  const postResource = createResource(postId, async (id) => {
    const res = await fetch(`https://jsonplaceholder.typicode.com/posts/${id}`);
    if (!res.ok) throw new Error('Failed to fetch post');
    return res.json() as Promise<Post>;
  });

  return (
    <div>
      <h1>Post Viewer</h1>

      <div>
        <button onClick={() => (postId.value = 1)}>Load Post 1</button>
        <button onClick={() => (postId.value = 2)}>Load Post 2</button>
        <button onClick={() => (postId.value = 3)}>Load Post 3</button>
        <button onClick={() => postResource.refetch()} disabled={!postId.value}>
          Refetch
        </button>
      </div>

      {postResource.loading.value && <div>Loading...</div>}

      {postResource.error.value && (
        <div className="error">Error: {postResource.error.value.message}</div>
      )}

      {postResource.value && (
        <div className="post">
          <h2>{postResource.value.title}</h2>
          <p>{postResource.value.body}</p>
        </div>
      )}
    </div>
  );
};

export default reactor(PostViewer);
```

## Pagination Example

```tsx
import { useSignal, createResource, useDerived, reactor } from '@signalis/react';

interface Post {
  id: number;
  title: string;
  body: string;
}

const PaginatedPosts = () => {
  const page = useSignal(1);
  const pageSize = useSignal(10);

  // Combine multiple signals into one source
  const params = useDerived(() => ({
    page: page.value,
    pageSize: pageSize.value,
  }));

  const postsResource = createResource(params, async ({ page, pageSize }) => {
    const start = (page - 1) * pageSize;
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts?_start=${start}&_limit=${pageSize}`,
    );
    return res.json() as Promise<Array<Post>>;
  });

  return (
    <div>
      <h1>Posts (Page {page.value})</h1>

      {postsResource.loading.value && <div>Loading...</div>}

      {postsResource.error.value && <div className="error">Error loading posts</div>}

      {postsResource.value && (
        <>
          <ul>
            {postsResource.value.map((post) => (
              <li key={post.id}>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
              </li>
            ))}
          </ul>

          <div className="pagination">
            <button onClick={() => page.value--} disabled={page.value === 1}>
              Previous
            </button>
            <span>Page {page.value}</span>
            <button onClick={() => page.value++}>Next</button>
          </div>

          <div>
            <label>
              Page Size:
              <select
                value={pageSize.value}
                onChange={(e) => {
                  pageSize.value = parseInt(e.target.value);
                  page.value = 1; // Reset to first page
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default reactor(PaginatedPosts);
```

## Search with Debounce

```tsx
import { useSignal, createResource, useSignalEffect, reactor } from '@signalis/react';

interface User {
  id: number;
  name: string;
  email: string;
}

const UserSearch = () => {
  const searchQuery = useSignal('');
  const debouncedQuery = useSignal('');

  // Debounce the search query
  useSignalEffect(() => {
    const currentQuery = searchQuery.value; // Read here to track dependency
    const timeoutId = setTimeout(() => {
      debouncedQuery.value = currentQuery;
    }, 300);

    return () => clearTimeout(timeoutId);
  });

  const usersResource = createResource(debouncedQuery, async (query) => {
    if (!query) return [];

    const res = await fetch(`https://jsonplaceholder.typicode.com/users?q=${query}`);
    return res.json() as Promise<Array<User>>;
  });

  return (
    <div>
      <h1>User Search</h1>

      <input
        type="text"
        value={searchQuery.value}
        onChange={(e) => (searchQuery.value = e.target.value)}
        placeholder="Search users..."
      />

      {usersResource.loading.value && <div>Searching...</div>}

      {usersResource.value && (
        <ul>
          {usersResource.value.length === 0 ? (
            <li>No users found</li>
          ) : (
            usersResource.value.map((user) => (
              <li key={user.id}>
                <strong>{user.name}</strong>
                <br />
                {user.email}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default reactor(UserSearch);
```

## Dependent Fetching

```tsx
import { useSignal, createResource, useDerived, reactor } from '@signalis/react';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  title: string;
  body: string;
}

const DependentFetching = () => {
  const userId = useSignal<number | null>(null);

  // First, fetch the user
  const userResource = createResource(userId, async (id) => {
    const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
    return res.json() as Promise<User>;
  });

  // Then, fetch the user's posts (depends on user being loaded)
  const postsResource = createResource(
    useDerived(() => userResource.value?.id),
    async (userId) => {
      const res = await fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}`);
      return res.json() as Promise<Array<Post>>;
    },
  );

  return (
    <div>
      <h1>User Posts</h1>

      <div>
        <button onClick={() => (userId.value = 1)}>User 1</button>
        <button onClick={() => (userId.value = 2)}>User 2</button>
        <button onClick={() => (userId.value = 3)}>User 3</button>
      </div>

      {userResource.loading.value && <div>Loading user...</div>}

      {userResource.value && (
        <div>
          <h2>{userResource.value.name}</h2>
          <p>{userResource.value.email}</p>
        </div>
      )}

      {postsResource.loading.value && <div>Loading posts...</div>}

      {postsResource.value && (
        <ul>
          {postsResource.value.map((post) => (
            <li key={post.id}>
              <h3>{post.title}</h3>
              <p>{post.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default reactor(DependentFetching);
```

## Optimistic Updates

```tsx
import { useSignal, createResource, reactor } from '@signalis/react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const OptimisticTodos = () => {
  const todosResource = createResource(async () => {
    const res = await fetch('/api/todos');
    return res.json() as Promise<Array<Todo>>;
  });

  const optimisticTodos = useSignal<Todo[]>([]);

  const toggleTodo = async (id: number) => {
    // Optimistically update UI using last value
    const current = todosResource.value || todosResource.last || [];
    const optimistic = current.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    optimisticTodos.value = optimistic; // Show optimistic update immediately

    try {
      // Send update to server
      await fetch(`/api/todos/${id}/toggle`, { method: 'POST' });

      // Refetch to get actual state
      todosResource.refetch();
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle todo', error);
      optimisticTodos.value = current; // Revert
      todosResource.refetch();
    }
  };

  return (
    <div>
      <h1>Optimistic Todos</h1>

      {todosResource.loading.value && <div>Loading...</div>}

      {todosResource.error.value && (
        <div className="error">Error: {todosResource.error.value.message}</div>
      )}

      <ul>
        {(optimisticTodos.value.length > 0 ? optimisticTodos.value : todosResource.value || []).map(
          (todo) => (
            <li key={todo.id}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                {todo.text}
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
};

export default reactor(OptimisticTodos);
```

## Key Concepts

### Resource State Management

Resources automatically manage three states:

- **Loading**: Initial fetch and refetching
- **Success**: Data available in `value`
- **Error**: Error available in `error`

### Reactive Sources

Resources refetch automatically when their source signal changes:

```typescript
const postId = createSignal(1);
const post = createResource(postId, fetchPost);

postId.value = 2; // Automatically triggers refetch
```

### Manual Refetch

Resources support different refetch patterns depending on how they're created:

**Non-sourced resources** (no reactive source) have a `refetch()` method:

```tsx
import { createResource, reactor } from '@signalis/react';

const DataViewer = () => {
  const data = createResource(async () => {
    const res = await fetch('/api/data');
    return res.json();
  });

  return (
    <div>
      <h1>Data Viewer</h1>
      {data.loading.value && <div>Loading...</div>}
      {data.error.value && <div>Error: {data.error.value.message}</div>}
      {data.value && <pre>{JSON.stringify(data.value, null, 2)}</pre>}
      <button onClick={() => data.refetch()}>Refresh</button>
    </div>
  );
};

export default reactor(DataViewer);
```

**Sourced resources** (with reactive source) don't have `refetch()` but refetch automatically when the source changes:

```tsx
import { createSignal, createResource, reactor } from '@signalis/react';

const PostViewer = () => {
  const postId = createSignal(1);
  const post = createResource(postId, async (id) => {
    const res = await fetch(`/api/posts/${id}`);
    return res.json();
  });

  return (
    <div>
      <h1>Post Viewer</h1>
      {post.loading.value && <div>Loading...</div>}
      {post.value && <div>{post.value.title}</div>}
      <button onClick={() => postId.value++}>Next Post</button>
    </div>
  );
};

export default reactor(PostViewer);
```

If you need manual control over sourced resources, you can create a separate signal for triggering refetches:

```tsx
import { createSignal, createResource, reactor } from '@signalis/react';

const ManualRefreshExample = () => {
  const postId = createSignal(1);
  const refreshTrigger = createSignal(0);

  const post = createResource(
    () => ({ id: postId.value, refresh: refreshTrigger.value }),
    ({ id }) => fetchPost(id),
  );

  return (
    <div>
      <h2>Post {postId.value}</h2>

      {post.loading.value && <div>Loading...</div>}

      {post.error.value && <div className="error">Error: {post.error.value.message}</div>}

      {post.value && (
        <div>
          <h3>{post.value.title}</h3>
          <p>{post.value.body}</p>
        </div>
      )}

      <div>
        <button onClick={() => postId.value++}>Next Post</button>
        <button onClick={() => refreshTrigger.value++}>Force Refresh</button>
      </div>
    </div>
  );
};

export default reactor(ManualRefreshExample);
```

## See Also

- [Resources](/core/resources) - Deep dive into resources
- [Signals](/core/signals) - Understanding reactive sources
- [Effects](/core/effects) - Side effects for async operations
- [useSignalEffect](/react/use-signal-effect) - React effects
