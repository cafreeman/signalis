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

  test('reading a derived mid-batch picks up a derived source that recomputed', () => {
    const count = createSignal(1);
    const double = createDerived(() => count.value * 2);
    const plusOne = createDerived(() => double.value + 1);

    const effectSpy = vi.fn(() => {
      plusOne.value;
    });

    createEffect(effectSpy);

    batch(() => {
      count.value = 2;

      // `double` recomputes to a new value and marks `plusOne` dirty straight away
      expect(double.value).toEqual(4);
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

  test('a mid-batch read does not make the derived and its effect run again when the batch ends', () => {
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

  test('a source written again after a mid-batch read still delivers its final value once', () => {
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

// Reads inside a batch reflect earlier writes at any depth, and no effect runs until the outermost
// batch ends (see the `batch` spec)
describe('batch consistency', () => {
  // s -> a -> b -> c, plus a second signal u that c also reads
  function createChain() {
    const s = createSignal(1);
    const u = createSignal(10);
    const a = createDerived(() => s.value * 2);
    const b = createDerived(() => a.value + 1);
    const c = createDerived(() => b.value + u.value);
    const expected = () => ({ a: s.value * 2, b: s.value * 2 + 1, c: s.value * 2 + 1 + u.value });
    return { s, u, a, b, c, expected };
  }

  function permutations<T>(items: Array<T>): Array<Array<T>> {
    if (items.length <= 1) {
      return [items];
    }
    return items.flatMap((item, i) =>
      permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
    );
  }

  describe('reads reflect earlier writes', () => {
    test('a derived two levels below the written signal, read first', () => {
      const { s, b } = createChain();
      b.value;

      batch(() => {
        s.value = 5;

        expect(b.value).toEqual(11);
      });
    });

    test('a derived three levels below the written signal, read first', () => {
      const { s, c } = createChain();
      c.value;

      batch(() => {
        s.value = 5;

        expect(c.value).toEqual(21);
      });
    });

    test('a diamond join', () => {
      const s = createSignal(1);
      const left = createDerived(() => s.value + 1);
      const right = createDerived(() => s.value + 2);
      const join = createDerived(() => left.value + right.value);
      join.value;

      batch(() => {
        s.value = 5;

        expect(join.value).toEqual(13);
      });
    });

    test('a grandchild that an effect tracks', () => {
      const { s, b } = createChain();
      const seen: Array<number> = [];
      const effectSpy = vi.fn(() => {
        seen.push(b.value);
      });
      createEffect(effectSpy);

      batch(() => {
        s.value = 5;

        expect(b.value).toEqual(11);
        expect(effectSpy).toHaveBeenCalledOnce();
      });

      expect(seen).toEqual([3, 11]);
    });

    test('a second write after a read', () => {
      const { s, b } = createChain();
      b.value;

      batch(() => {
        s.value = 5;
        expect(b.value).toEqual(11);
        s.value = 6;
        expect(b.value).toEqual(13);
      });
    });

    test('reading top-down and bottom-up gives the same values', () => {
      const topDown = createChain();
      const bottomUp = createChain();
      [topDown, bottomUp].forEach((graph) => graph.c.value);

      const readTopDown: Array<number> = [];
      const readBottomUp: Array<number> = [];

      batch(() => {
        topDown.s.value = 5;
        readTopDown.push(topDown.a.value, topDown.b.value, topDown.c.value);
      });
      batch(() => {
        bottomUp.s.value = 5;
        readBottomUp.push(bottomUp.c.value, bottomUp.b.value, bottomUp.a.value);
      });

      expect(readTopDown).toEqual([10, 11, 21]);
      expect(readBottomUp).toEqual([21, 11, 10]);
    });

    test('in every order of writes and reads', () => {
      const operations = ['write s', 'write u', 'read a', 'read b', 'read c'];

      permutations(operations).forEach((order) => {
        const { s, u, a, b, c, expected } = createChain();
        c.value;
        let next = 100;

        batch(() => {
          order.forEach((operation) => {
            const step = `${order.join(', ')} at "${operation}"`;
            if (operation === 'write s') {
              s.value = next++;
            } else if (operation === 'write u') {
              u.value = next++;
            } else if (operation === 'read a') {
              expect(a.value, step).toEqual(expected().a);
            } else if (operation === 'read b') {
              expect(b.value, step).toEqual(expected().b);
            } else {
              expect(c.value, step).toEqual(expected().c);
            }
          });
        });
      });
    });

    test('a derived read for the first time inside the batch', () => {
      const { s, b } = createChain();

      batch(() => {
        s.value = 5;

        expect(b.value).toEqual(11);
      });
    });

    test('a derived that reads both a signal and a derived below it', () => {
      const s = createSignal(1);
      const a = createDerived(() => s.value * 2);
      const mixed = createDerived(() => a.value + s.value);
      mixed.value;

      batch(() => {
        s.value = 5;

        expect(mixed.value).toEqual(15);
      });
    });

    test('a read of each derived from the top down', () => {
      const { s, a, b, c } = createChain();
      c.value;

      batch(() => {
        s.value = 5;

        expect([a.value, b.value, c.value]).toEqual([10, 11, 21]);
      });
    });
  });

  describe('effects do not run until the outermost batch ends', () => {
    test('a read followed by more writes', () => {
      const s = createSignal(1);
      const u = createSignal(1);
      const v = createSignal(1);
      const a = createDerived(() => s.value * 2);
      const runs: Array<string> = [];
      createEffect(() => {
        runs.push(`${s.value},${u.value},${v.value}`);
      });
      a.value;

      batch(() => {
        s.value = 5;
        a.value;
        u.value = 2;
        v.value = 3;
      });

      expect(runs).toEqual(['1,1,1', '5,2,3']);
    });

    test('in every order of writes and reads', () => {
      const operations = ['write s', 'write u', 'read a', 'read b', 'read c'];

      permutations(operations).forEach((order) => {
        const { s, u, a, b, c } = createChain();
        const effectSpy = vi.fn(() => {
          s.value;
          u.value;
          a.value;
          b.value;
          c.value;
        });
        createEffect(effectSpy);
        let next = 100;

        batch(() => {
          order.forEach((operation) => {
            if (operation === 'write s') {
              s.value = next++;
            } else if (operation === 'write u') {
              u.value = next++;
            } else if (operation === 'read a') {
              a.value;
            } else if (operation === 'read b') {
              b.value;
            } else {
              c.value;
            }

            expect(effectSpy, `${order.join(', ')} after "${operation}"`).toHaveBeenCalledOnce();
          });
        });

        expect(effectSpy, order.join(', ')).toHaveBeenCalledTimes(2);
      });
    });

    test('nested batches run the effect once, after the outer batch', () => {
      const s = createSignal(1);
      const a = createDerived(() => s.value * 2);
      const effectSpy = vi.fn(() => {
        a.value;
      });
      createEffect(effectSpy);

      batch(() => {
        batch(() => {
          s.value = 2;
          a.value;
        });

        expect(effectSpy).toHaveBeenCalledOnce();
        s.value = 3;
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);
    });

    test('several writes to the same and different signals run the effect once', () => {
      const x = createSignal(0);
      const y = createSignal(0);
      const seen: Array<string> = [];
      createEffect(() => {
        seen.push(`${x.value},${y.value}`);
      });

      batch(() => {
        x.value = 1;
        x.value = 2;
        y.value = 1;
      });

      expect(seen).toEqual(['0,0', '2,1']);
    });
  });
});
