import { describe, expect, test, vi } from 'vitest';
import { createDerived, createSignal } from '../src';

describe('Derived', () => {
  test('it reacts to signal changes', () => {
    const foo = createSignal(0);

    const isEven = createDerived(() => {
      return foo.value % 2 === 0;
    });

    expect(isEven.value).to.be.true;

    foo.value += 1;

    expect(isEven.value).to.be.false;
  });

  test('it computes on initial creation, and recomputes when dependencies change', () => {
    const foo = createSignal(0);

    const spy = vi.fn(() => {
      return foo.value;
    });

    const isEven = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();

    foo.value = 1;
    isEven.value;

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it only updates relevant derivations', () => {
    const foo = createSignal(0);
    const bar = createSignal(0);

    const spy = vi.fn(() => {
      return foo.value % 2 === 0;
    });

    const isEven = createDerived(spy);

    bar.value += 1;
    isEven.value;

    expect(spy).toHaveBeenCalledOnce();

    foo.value += 1;
    isEven.value;

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('one dependency can depend on another', () => {
    const foo = createSignal('foo');

    const uppercaseSpy = vi.fn(() => {
      return foo.value.toUpperCase();
    });

    const toUpperCase = createDerived(uppercaseSpy);

    const lowercaseSpy = vi.fn(() => {
      return toUpperCase.value.toLowerCase();
    });

    const toLowerCase = createDerived(lowercaseSpy);

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

  test('chain of derived values', () => {
    const foo = createSignal(0);

    const a = createDerived(() => {
      return foo.value;
    });

    const b = createDerived(() => {
      return a.value;
    });

    const c = createDerived(() => {
      return b.value;
    });

    const d = createDerived(() => {
      return c.value;
    });

    expect(d.value).toEqual(0);

    foo.value = 1;

    expect(d.value).toEqual(1);
  });

  test('it can depend on arrays', () => {
    const someArray = createSignal<Array<number>>([]);

    const spy = vi.fn(() => {
      return someArray.value.length;
    });

    const arrayLength = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();

    someArray.value.push(1);

    expect(arrayLength.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    someArray.value = [...someArray.value, 2];

    expect(arrayLength.value).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it can depend on objects', () => {
    const someObject = createSignal<Record<string, number>>({});

    const spy = vi.fn(() => {
      return Object.keys(someObject.value).length;
    });

    const arrayLength = createDerived(spy);

    expect(spy).toHaveBeenCalledOnce();
    someObject.value.a = 1;

    expect(arrayLength.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    someObject.value = { ...someObject.value, b: 2 };

    expect(arrayLength.value).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
