# Todo List Example

A complete todo list application demonstrating stores, derived values, and CRUD operations.

## Using Stores

```tsx
import { FormEvent } from 'react';
import { createStore, update, useDerived, useSignalEffect, reactor } from '@signalis/react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

type Filter = 'all' | 'active' | 'completed';

const TodoApp = () => {
  // Create a store for the entire app state
  const store = createStore({
    todos: [] as Array<Todo>,
    filter: 'all' as Filter,
    input: '',

    // Derived values as getters
    get filteredTodos() {
      switch (this.filter) {
        case 'active':
          return this.todos.filter((t) => !t.completed);
        case 'completed':
          return this.todos.filter((t) => t.completed);
        default:
          return this.todos;
      }
    },

    get activeCount() {
      return this.todos.filter((t) => !t.completed).length;
    },

    get completedCount() {
      return this.todos.filter((t) => t.completed).length;
    },

    // Methods
    addTodo(text: string) {
      if (!text.trim()) return;

      update(this.todos, (draft) => {
        draft.push({
          id: Date.now(),
          text: text.trim(),
          completed: false,
        });
      });

      update(this, (draft) => {
        draft.input = '';
      });
    },

    removeTodo(id: number) {
      update(this.todos, (draft) => {
        const index = draft.findIndex((t) => t.id === id);
        if (index !== -1) {
          draft.splice(index, 1);
        }
      });
    },

    toggleTodo(id: number) {
      update(this.todos, (draft) => {
        const todo = draft.find((t) => t.id === id);
        if (todo) {
          todo.completed = !todo.completed;
        }
      });
    },

    clearCompleted() {
      update(this.todos, (draft) => {
        return draft.filter((t) => !t.completed);
      });
    },

    setFilter(filter: Filter) {
      update(this, (draft) => {
        draft.filter = filter;
      });
    },
  });

  // Save to localStorage
  useSignalEffect(() => {
    localStorage.setItem('todos', JSON.stringify(store.todos));
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    store.addTodo(store.input);
  };

  return (
    <div className="todo-app">
      <h1>Todos</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={store.input}
          onChange={(e) =>
            update(store, (draft) => {
              draft.input = e.target.value;
            })
          }
          placeholder="What needs to be done?"
        />
        <button type="submit">Add</button>
      </form>

      <div className="filters">
        <button
          className={store.filter === 'all' ? 'active' : ''}
          onClick={() => store.setFilter('all')}
        >
          All ({store.todos.length})
        </button>
        <button
          className={store.filter === 'active' ? 'active' : ''}
          onClick={() => store.setFilter('active')}
        >
          Active ({store.activeCount})
        </button>
        <button
          className={store.filter === 'completed' ? 'active' : ''}
          onClick={() => store.setFilter('completed')}
        >
          Completed ({store.completedCount})
        </button>
      </div>

      <ul className="todo-list">
        {store.filteredTodos.map((todo) => (
          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => store.toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => store.removeTodo(todo.id)}>×</button>
          </li>
        ))}
      </ul>

      {store.completedCount > 0 && (
        <button onClick={() => store.clearCompleted()}>
          Clear Completed ({store.completedCount})
        </button>
      )}
    </div>
  );
};

export default reactor(TodoApp);
```

## Using Individual Signals

```tsx
import { useSignal, useDerived, useSignalEffect, reactor } from '@signalis/react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const TodoApp = () => {
  const todos = useSignal<Array<Todo>>([]);
  const filter = useSignal<'all' | 'active' | 'completed'>('all');
  const input = useSignal('');

  // Derived values
  const filteredTodos = useDerived(() => {
    switch (filter.value) {
      case 'active':
        return todos.value.filter((t) => !t.completed);
      case 'completed':
        return todos.value.filter((t) => t.completed);
      default:
        return todos.value;
    }
  });

  const activeCount = useDerived(() => todos.value.filter((t) => !t.completed).length);

  const completedCount = useDerived(() => todos.value.filter((t) => t.completed).length);

  // Save to localStorage
  useSignalEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos.value));
  });

  // Actions
  const addTodo = () => {
    if (!input.value.trim()) return;

    todos.value = [
      ...todos.value,
      {
        id: Date.now(),
        text: input.value.trim(),
        completed: false,
      },
    ];

    input.value = '';
  };

  const removeTodo = (id: number) => {
    todos.value = todos.value.filter((t) => t.id !== id);
  };

  const toggleTodo = (id: number) => {
    todos.value = todos.value.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const clearCompleted = () => {
    todos.value = todos.value.filter((t) => !t.completed);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    addTodo();
  };

  return <div className="todo-app">{/* Same JSX as above */}</div>;
};

export default reactor(TodoApp);
```

## Key Features

### Fine-Grained Reactivity

With stores, changing a specific todo only notifies components that read that specific todo:

```typescript
// Only components reading this specific todo will re-render
update(store.todos[0], (draft) => {
  draft.completed = true;
});
```

### Computed Getters

Getters on stores are automatically reactive:

```typescript
get completedCount() {
  return this.todos.filter(t => t.completed).length;
}

// Accessing it creates a dependency
console.log(store.completedCount);
```

### Method Binding

Methods defined on the store are automatically bound:

```typescript
const { addTodo } = store;
addTodo('New todo'); // Works correctly (this is bound)
```

## Comparison: Stores vs Signals

### Stores

- **Pros**: No `.value` calls, fine-grained reactivity, ergonomic methods
- **Cons**: Must use `update()` function, slightly more complex

### Signals

- **Pros**: Simple, explicit, familiar
- **Cons**: Immutable updates required, `.value` everywhere

Choose stores for complex nested state, signals for simple values.

## Try It Yourself

Enhance the app with:

- Edit functionality (double-click to edit)
- Due dates with sorting
- Categories or tags
- Drag-and-drop reordering
- Bulk operations (select all, delete all, etc.)
- Search/filter by text

## See Also

- [Stores](/core/stores) - Deep dive into stores
- [update()](/core/utilities) - Understanding the update function
- [Derived](/core/derived) - Computed values
- [useSignalEffect](/react/use-signal-effect) - Side effects in React
