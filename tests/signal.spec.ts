import { expect, describe, test, vi } from 'vitest';
import { createSignal } from '../src/signal';
import { createEffect } from '../src/effect';
import isEqual from 'lodash/isEqual';

describe('Signal', () => {
  test('it works', () => {
    let foo = createSignal('foo');

    let spy = vi.fn(() => {
      foo.value;
    });

    createEffect(spy);

    foo.value = 'bar';

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it can be made volative by passing false as second argument', () => {
    let foo = createSignal('foo', false);

    let spy = vi.fn(() => {
      foo.value;
    });

    createEffect(spy);

    foo.value = 'foo';

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it can accept a custom equality function', () => {
    let foo = createSignal({ a: 1 }, isEqual);

    let spy = vi.fn(() => {
      foo.value;
    });

    createEffect(spy);

    foo.value = { a: 1 };

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('peek does not trigger updates', () => {
    let foo = createSignal('foo');

    let spy = vi.fn(() => {
      foo.peek();
    });

    createEffect(spy);

    foo.value = 'bar';

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
