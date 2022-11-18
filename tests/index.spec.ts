import { describe, expect, test, vi } from 'vitest';
import { createSignal, createDerived } from '../src';

describe('Signal', () => {
  test('it reacts to signal changes', () => {
    let foo = createSignal(0);

    let isEven = createDerived(() => {
      return foo.value % 2 === 0;
    });

    expect(isEven.value).to.be.true;

    foo.value += 1;

    expect(isEven.value).to.be.false;
  });

  test('it only updates relevant derivations', () => {
    let foo = createSignal(0);
    let bar = createSignal(0);

    let spy = vi.fn(() => {
      return foo.value % 2 === 0;
    });

    let isEven = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();

    bar.value += 1;
    isEven.value;

    expect(spy).toHaveBeenCalledOnce();

    foo.value += 1;
    isEven.value;

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
