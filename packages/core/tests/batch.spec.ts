import { describe, expect, test, vi } from 'vitest';
import { createDerived } from '../src/derived';
import { createEffect } from '../src/effect';
import { createSignal } from '../src/signal';
import { batch } from '../src/batch';

describe.todo('batch', () => {
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

  test('effect with multiple updates to the same value', () => {
    const foo = createSignal(0);

    let effectResult = foo.value;

    const effectSpy = vi.fn(() => {
      effectResult = foo.value;
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();
    expect(effectResult).toEqual(0);

    batch(() => {
      foo.value = 1;
      foo.value = 2;
    });

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(effectResult).toEqual(2);
  });

  test('derived with multiple updates to the same value', () => {
    const foo = createSignal(0);

    const derivedSpy = vi.fn(() => {
      return foo.value;
    });

    const derived = createDerived(derivedSpy);

    expect(derivedSpy).toHaveBeenCalledOnce();
    expect(derived.value).toEqual(0);

    batch(() => {
      foo.value = 1;
      foo.value = 2;
    });

    expect(derived.value).toEqual(2);
    expect(derivedSpy).toHaveBeenCalledTimes(2);
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

  test('a big mess of interactions', () => {
    const foo = createSignal(0);
    const bar = createSignal(0);

    const isFooOdd = createDerived(() => {
      return foo.value % 2 === 0;
    });

    const isBarOdd = createDerived(() => {
      return bar.value % 2 === 0;
    });

    const fooSpy = vi.fn(() => {
      foo.value;
      isFooOdd.value;
    });

    createEffect(fooSpy);

    const barSpy = vi.fn(() => {
      bar.value;
      isBarOdd.value;
    });

    createEffect(barSpy);

    const fooBarSpy = vi.fn(() => {
      foo.value;
      bar.value;
      isFooOdd.value;
      isBarOdd.value;
    });

    createEffect(fooBarSpy);

    batch(() => {
      foo.value = 1;
      bar.value = 1;

      isFooOdd.value;
      isBarOdd.value;
    });

    expect(fooSpy).toHaveBeenCalledTimes(2);
    expect(barSpy).toHaveBeenCalledTimes(2);
    expect(fooBarSpy).toHaveBeenCalledTimes(2);
  });
});
