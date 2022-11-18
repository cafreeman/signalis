import { describe, expect, test, vi } from 'vitest';
import { createSignal, createDerived } from '../src';

describe('Derived', () => {
  test('it reacts to signal changes', () => {
    let foo = createSignal(0);

    let isEven = createDerived(() => {
      return foo.value % 2 === 0;
    });

    expect(isEven.value).to.be.true;

    foo.value += 1;

    expect(isEven.value).to.be.false;
  });

  test('it computes on initial creation, and recomputes when dependencies change', () => {
    let foo = createSignal(0);

    let spy = vi.fn(() => {
      return foo.value;
    });

    let isEven = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();

    foo.value = 1;
    isEven.value;

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it only updates relevant derivations', () => {
    let foo = createSignal(0);
    let bar = createSignal(0);

    let spy = vi.fn(() => {
      return foo.value % 2 === 0;
    });

    let isEven = createDerived(spy);

    bar.value += 1;
    isEven.value;

    expect(spy).toHaveBeenCalledOnce();

    foo.value += 1;
    isEven.value;

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('one dependency can depend on another', () => {
    let foo = createSignal('foo');

    let uppercaseSpy = vi.fn(() => {
      return foo.value.toUpperCase();
    });

    let toUpperCase = createDerived(uppercaseSpy);

    let lowercaseSpy = vi.fn(() => {
      return toUpperCase.value.toLowerCase();
    });

    let toLowerCase = createDerived(lowercaseSpy);

    foo.value = 'bar';

    console.log('ACCESSING UPPERCASE, SHOULD PULL ON FOO SIGNAL');
    expect(toUpperCase.value).toEqual('BAR');
    console.log('ACCESSING LOWERCASE, SHOULD PULL ON UPPERCASE');
    expect(toLowerCase.value).toEqual('bar');

    expect(uppercaseSpy).toHaveBeenCalledTimes(2);
    expect(lowercaseSpy).toHaveBeenCalledTimes(2);
  });
});
