import { type Signal, createDerived, createSignal } from '@signalis/react';
import { produce } from 'immer';

export interface Todo {
  id: number;
  text: string;
  complete: boolean;
}

class TodoStore {
  todos: Signal<Array<Todo>> = createSignal([]);
  currentMaxId = createDerived(() => Math.max(...this.todos.value.map((todo) => todo.id)));

  constructor(todos?: Array<Todo>) {
    if (todos) {
      this.todos.value = todos;
    }
  }

  addTodo(todoValue: string) {
    this.todos.value = produce(this.todos.value, (draft) => {
      draft.push({
        id: this.currentMaxId.value + 1,
        text: todoValue,
        complete: false,
      });
    });
  }

  removeTodo(id: number) {
    this.todos.value = produce(this.todos.value, (draft) => {
      const toRemove = draft.findIndex((v) => v.id === id);
      draft.splice(toRemove, 1);
    });
  }

  toggleComplete(id: number) {
    this.todos.value = produce(this.todos.value, (draft) => {
      const toUpdate = draft.findIndex((v) => v.id === id);
      const currentStatus = draft[toUpdate].complete;
      draft[toUpdate].complete = !currentStatus;
    });
  }
}

const initialTodos = [
  {
    id: 1,
    text: 'Feed cats',
    complete: false,
  },
  {
    id: 2,
    text: 'Cook dinner',
    complete: false,
  },
];

export const store = new TodoStore(initialTodos);
