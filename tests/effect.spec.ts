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

  it.skip('prevents cycles', () => {
    let foo = createSignal(0);

    let spy = vi.fn(() => {
      foo.value;
      foo.value++;
    });

    createEffect(spy);

    foo.value++;

    expect(spy).toHaveBeenCalledOnce();
  });

  it.only('can dispose', () => {
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
});
