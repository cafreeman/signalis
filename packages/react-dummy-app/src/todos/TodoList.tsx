import { type Signal, reactor, useDerived, useSignal } from '@signalis/react';
import { store, type Todo } from './TodoStore';
import React from 'react';

interface TodoItemProps {
  todo: Todo;
  handleCheck: (id: number) => void;
  handleRemove: (id: number) => void;
}

function TodoItem({ todo, handleCheck, handleRemove }: TodoItemProps) {
  const toggleCheckbox = () => {
    handleCheck(todo.id);
  };

  const onRemove = () => {
    handleRemove(todo.id);
  };

  return (
    <li className="border border-b-0 last:border-b first:rounded-t last:rounded-b border-slate-300 p-4 hover:bg-gray-200">
      <div className="flex flex-row justify-between">
        <span>{todo.text}</span>
        <div className="flex items-center">
          <input
            className="cursor-pointer"
            type="checkbox"
            name="complete"
            checked={todo.complete}
            onChange={toggleCheckbox}
          />
          <button className="pl-2" onClick={onRemove}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        </div>
      </div>
    </li>
  );
}

interface StatusPickerItemProps {
  status: string;
  active: boolean;
  handleClick: (s: string) => void;
}

function StatusPickerItem({ status, active, handleClick }: StatusPickerItemProps) {
  return (
    <div
      className={`grow ${
        active ? 'bg-slate-600 text-white' : 'bg-white text-slate-600'
      } py-2 px-4 cursor-pointer border first:rounded-l last:rounded-r`}
      onClick={() => handleClick(status)}
    >
      <span className="flex justify-center">{status}</span>
    </div>
  );
}

interface StatusPickerProps {
  status: Signal<string>;
  updateStatus: (v: string) => void;
}

const StatusPicker = reactor(({ status, updateStatus }: StatusPickerProps) => {
  const handleStatusUpdate = (s: string) => {
    updateStatus(s);
  };

  return (
    <div className="flex flex-row justify-center pt-2">
      {['All', 'Complete', 'Incomplete'].map((statusOption) => {
        return (
          <StatusPickerItem
            key={statusOption}
            status={statusOption}
            active={status.value === statusOption}
            handleClick={handleStatusUpdate}
          />
        );
      })}
    </div>
  );
});

StatusPicker.displayName = 'StatusPicker';

interface NewTodoProps {
  handleSubmit: (value: string) => void;
}

const NewTodo = reactor(({ handleSubmit }: NewTodoProps) => {
  const newTodo = useSignal('');

  const handleNewTodoInput = (e: React.FormEvent<HTMLInputElement>) => {
    newTodo.value = e.currentTarget.value;
  };

  const addTodo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(newTodo.value);
    newTodo.value = '';
  };

  return (
    <form onSubmit={addTodo} className="flex flex-row py-6">
      <input
        type="text"
        name="new todo"
        id="new-todo-input"
        className="w-full border rounded border-slate-300 border-wid"
        value={newTodo.value}
        onInput={handleNewTodoInput}
      />

      <button type="submit" className="border rounded bg-slate-500 text-white ml-1 py-1 px-2">
        Submit
      </button>
    </form>
  );
});

NewTodo.displayName = 'NewTodo';

function TodoList() {
  const currentStatus = useSignal('All');

  const todosList = useDerived(() => {
    if (currentStatus.value === 'Incomplete') {
      return store.todos.value.filter((todo) => !todo.complete);
    }

    if (currentStatus.value === 'Complete') {
      return store.todos.value.filter((todo) => todo.complete);
    }

    return store.todos.value;
  });

  const toggleComplete = (id: number) => store.toggleComplete(id);
  const removeTodo = (id: number) => store.removeTodo(id);
  const addTodo = (value: string) => store.addTodo(value);

  return (
    <div className="max-w-screen-md mx-auto">
      <NewTodo handleSubmit={addTodo} />
      <StatusPicker
        status={currentStatus}
        updateStatus={(status: string) => (currentStatus.value = status)}
      />
      <ul className="pt-4">
        {todosList.value.map((todo) => {
          return (
            <TodoItem
              key={todo.id}
              todo={todo}
              handleCheck={toggleComplete}
              handleRemove={removeTodo}
            />
          );
        })}
      </ul>
    </div>
  );
}

export default reactor(TodoList);
