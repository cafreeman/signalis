import { describe, expect, it, test, vi } from 'vitest';
import { createEffect } from '../src/effect';
import { createDerived, createSignal } from '../src';

describe('Effect', () => {
  test('it works', () => {
    let foo = createSignal(0);

    let effectSpy = vi.fn(() => {
      foo.value;
    });

    createEffect(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledOnce();

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('it works with derived values', () => {
    let foo = createSignal('foo');

    let uppercase = createDerived(() => {
      return foo.value.toUpperCase();
    });

    let effectSpy = vi.fn(() => {
      uppercase.value;
    });

    createEffect(effectSpy);

    foo.value = 'bar';

    expect(effectSpy).toHaveBeenCalledOnce();
  });

  it('can dispose', () => {
    let foo = createSignal(0);

    let effectSpy = vi.fn(() => {
      foo.value;
    });

    const dispose = createEffect(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledOnce();

    expect(dispose()).to.be.true;

    foo.value++;

    expect(effectSpy).toHaveBeenCalledOnce();
  });

  it('catches cycles', () => {
    let foo = createSignal(0);

    let iterationCount = 0;

    const effectWrapper = () => {
      createEffect(() => {
        iterationCount++;
        if (iterationCount > 200) {
          throw new Error('test failed');
        }
        foo.value;
        foo.value++;
      });

      foo.value++;
    };

    expect(effectWrapper).toThrowError(/cycle detected/);
  });
});
