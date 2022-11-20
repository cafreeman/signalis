import { expect, describe, test, vi } from 'vitest';
import { createSignal, Peek } from '../src/signal';
import { createEffect } from '../src/effect';
import isEqual from 'lodash/isEqual';

describe('Signal', () => {
  test('it works', () => {
    const foo = createSignal('foo');

    const spy = vi.fn(() => {
      foo.value;
    });

    createEffect(spy);

    foo.value = 'bar';

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it can be made volative by passing false as second argument', () => {
    const foo = createSignal('foo', false);

    const spy = vi.fn(() => {
      foo.value;
    });

    createEffect(spy);

    foo.value = 'foo';

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it can accept a custom equality function', () => {
    const foo = createSignal({ a: 1 }, isEqual);

    const spy = vi.fn(() => {
      foo.value;
    });

    createEffect(spy);

    foo.value = { a: 1 };

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('peek does not trigger updates', () => {
    const foo = createSignal('foo');

    const spy = vi.fn(() => {
      foo[Peek]();
    });

    createEffect(spy);

    foo.value = 'bar';

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
