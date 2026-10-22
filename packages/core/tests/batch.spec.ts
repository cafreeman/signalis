import { describe, expect, test, vi } from 'vitest';
import { batch } from '../src/batch';
import { createDerived } from '../src/derived';
import { createEffect } from '../src/effect';
import { createSignal } from '../src/signal';

describe('batch', () => {
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

    derived.value;

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
    const double = createDerived(() => count.value * 2, 'double');
    const triple = createDerived(() => count.value * 3, 'triple');

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

  test('reading a derived mid-batch delivers the mark buffered by a derived source that changed', () => {
    const count = createSignal(1);
    const double = createDerived(() => count.value * 2);
    const plusOne = createDerived(() => double.value + 1);

    const effectSpy = vi.fn(() => {
      plusOne.value;
    });

    createEffect(effectSpy);

    batch(() => {
      count.value = 2;

      // `double` recomputes to a new value, and the mark it owes `plusOne` is buffered on it
      // until the batch ends...
      expect(double.value).toEqual(4);
      // ...unless `plusOne` is read first, which delivers that mark early
      expect(plusOne.value).toEqual(5);
      expect(effectSpy).toHaveBeenCalledOnce();
    });

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(plusOne.value).toEqual(5);
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

  test('a large batch followed by a small one delivers every write exactly once', () => {
    const signals = Array.from({ length: 1000 }, (_, i) => createSignal(i));
    const spies = signals.map((signal) =>
      vi.fn(() => {
        signal.value;
      }),
    );
    spies.forEach((spy) => createEffect(spy));

    batch(() => {
      signals.forEach((signal) => signal.value++);
    });

    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(2));

    batch(() => {
      signals[3]!.value++;
      signals[500]!.value++;
    });

    spies.forEach((spy, i) => expect(spy).toHaveBeenCalledTimes(i === 3 || i === 500 ? 3 : 2));
  });

  test('a mark delivered early by a mid-batch read is not delivered again when the batch ends', () => {
    const count = createSignal(1);
    const derivedSpy = vi.fn(() => count.value * 2);
    const double = createDerived(derivedSpy);
    const effectSpy = vi.fn(() => {
      double.value;
    });

    createEffect(effectSpy);

    batch(() => {
      count.value = 2;
      expect(double.value).toEqual(4);
    });

    expect(derivedSpy).toHaveBeenCalledTimes(2);
    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('a source written again after a mid-batch read delivers its final mark exactly once', () => {
    const count = createSignal(1);
    const derivedSpy = vi.fn(() => count.value * 2);
    const double = createDerived(derivedSpy);
    const seen: Array<number> = [];
    const effectSpy = vi.fn(() => {
      seen.push(double.value);
    });

    createEffect(effectSpy);

    batch(() => {
      count.value = 2;
      expect(double.value).toEqual(4);
      count.value = 3;
    });

    expect(seen).toEqual([2, 6]);
    expect(effectSpy).toHaveBeenCalledTimes(2);
    // initial run, the mid-batch read, and the recompute the effect triggers after the batch
    expect(derivedSpy).toHaveBeenCalledTimes(3);
  });
});
