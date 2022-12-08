import { expect, describe, test, vi } from 'vitest';
import { createSignal, createEffect } from '../src/index.js';
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
});
