import { describe, expect, test, vi } from 'vitest';
import { createDerived, createSignal } from '../src';

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

    expect(toUpperCase.value).toEqual('BAR');
    expect(toLowerCase.value).toEqual('bar');

    expect(uppercaseSpy).toHaveBeenCalledTimes(2);
    expect(lowercaseSpy).toHaveBeenCalledTimes(2);

    foo.value = 'baz';

    expect(toUpperCase.value).toEqual('BAZ');
    expect(toLowerCase.value).toEqual('baz');

    expect(lowercaseSpy).toHaveBeenCalledTimes(3);
    expect(uppercaseSpy).toHaveBeenCalledTimes(3);
  });

  test('it can depend on arrays', () => {
    let someArray = createSignal<Array<number>>([]);

    let spy = vi.fn(() => {
      return someArray.value.length;
    });

    let arrayLength = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();

    someArray.value.push(1);

    expect(arrayLength.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    someArray.value = [...someArray.value, 2];

    expect(arrayLength.value).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it can depend on objects', () => {
    let someObject = createSignal<Record<string, number>>({});

    let spy = vi.fn(() => {
      return Object.keys(someObject.value).length;
    });

    let arrayLength = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();
    someObject.value.a = 1;

    expect(arrayLength.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    someObject.value = { ...someObject.value, b: 2 };

    expect(arrayLength.value).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
