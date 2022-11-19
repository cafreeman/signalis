import { describe, expect, test, vi } from 'vitest';
import { batch } from '../src/batch';
import { createDerived } from '../src/derived';
import { createEffect } from '../src/effect';
import { createSignal } from '../src/signal';

describe.only('batch', () => {
  test('batching with derived', () => {
    const todos = createSignal<Array<{ text: string }>>([]);
    const text = createSignal('blah');

    const todoSpy = vi.fn(() => {
      return {
        todos: todos.value,
        text: text.value,
      };
    });

    const todoList = createDerived(todoSpy);

    createEffect(() => {
      todoList.value;
    });

    expect(todoSpy).toHaveBeenCalledOnce();

    function addTodo() {
      batch(() => {
        todos.value = [...todos.value, { text: text.value }];
        text.value = '';
      });
    }

    addTodo();

    expect(todoSpy).toHaveBeenCalledTimes(2);
  });

  test('batching with effects', () => {
    const todos = createSignal<Array<{ text: string }>>([]);
    const text = createSignal('blah');

    const effectSpy = vi.fn(() => {
      return {
        todos: todos.value,
        text: text.value,
      };
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    batch(() => {
      todos.value = [...todos.value, { text: text.value }];
      text.value = '';
    });

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('nested batch with derived should only update when the outermost batch resolves', () => {
    const todos = createSignal<Array<{ text: string }>>([]);
    const text = createSignal('foo');

    const todoSpy = vi.fn(() => {
      return {
        todos: todos.value,
        text: text.value,
      };
    });

    const todoList = createDerived(todoSpy);

    createEffect(() => {
      todoList.value;
    });

    expect(todoSpy).toHaveBeenCalledOnce();

    batch(() => {
      todos.value = [...todos.value, { text: text.value }];
      text.value = 'bar';

      batch(() => {
        todos.value = [...todos.value, { text: text.value }];
        text.value = 'baz';
      });
    });

    expect(todoSpy).toHaveBeenCalledTimes(2);
  });

  test('nested batch with effects should only update when the outermost batch resolves', () => {
    const todos = createSignal<Array<{ text: string }>>([]);
    const text = createSignal('foo');

    const effectSpy = vi.fn(() => {
      return {
        todos: todos.value,
        text: text.value,
      };
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    batch(() => {
      todos.value = [...todos.value, { text: text.value }];
      text.value = 'bar';

      batch(() => {
        todos.value = [...todos.value, { text: text.value }];
        text.value = 'baz';
      });
    });

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('local updates in batches', () => {
    const count = createSignal(0);
    const double = createDerived(() => count.value * 2);
    const triple = createDerived(() => count.value * 3);

    const effectSpy = vi.fn(() => {
      double.value;
      triple.value;
    });

    createEffect(effectSpy);

    batch(() => {
      // set `count`, invalidating `double` and `triple`:
      count.value = 1;

      // Despite being batched, `double` reflects the new computed value.
      // However, `triple` will only update once the callback completes.
      expect(double.value).toEqual(2);
    });

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });
});
