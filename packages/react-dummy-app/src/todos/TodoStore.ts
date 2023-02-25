import { createStore, update } from '@signalis/react';

export interface Todo {
  id: number;
  text: string;
  complete: boolean;
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

export const store = createStore({
  todos: initialTodos,

  get currentMaxId() {
    return Math.max(...this.todos.map((todo: Todo) => todo.id));
  },

  addTodo(todoValue: string) {
    update(this.todos, (draft) => {
      draft.push({
        id: this.currentMaxId + 1,
        text: todoValue,
        complete: false,
      });
    });
  },

  removeTodo(id: number) {
    update(this.todos, (draft) => {
      const toRemove = draft.findIndex((v) => v.id === id);
      draft.splice(toRemove, 1);
    });
  },

  toggleComplete(id: number) {
    update(this.todos, (draft) => {
      const toUpdate = draft.findIndex((v) => v.id === id);
      draft[toUpdate].complete = !draft[toUpdate].complete;
    });
  },
});
