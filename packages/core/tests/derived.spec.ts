import { describe, expect, test, vi } from 'vitest';
import { createDerived } from '../src/derived';
import { createSignal } from '../src/signal';

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

  test('it does not compute on initial creation, but computes when dependencies change', () => {
    const foo = createSignal(0);

    const spy = vi.fn(() => {
      return foo.value;
    });

    const isEven = createDerived(spy);

    expect(spy).not.toHaveBeenCalled();

    foo.value = 1;
    isEven.value;

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('it only updates relevant derivations', () => {
    const foo = createSignal(0);
    const bar = createSignal(0);

    const fooSpy = vi.fn(() => {
      return foo.value % 2 === 0;
    });

    const isEven = createDerived(fooSpy);
    expect(fooSpy).not.toHaveBeenCalled();
    expect(isEven.value).toEqual(true);
    expect(fooSpy).toHaveBeenCalledOnce();

    bar.value += 1;

    expect(fooSpy).toHaveBeenCalledOnce();
    expect(isEven.value).toEqual(true);

    foo.value += 1;

    expect(isEven.value).toEqual(false);
    expect(fooSpy).toHaveBeenCalledTimes(2);

    bar.value += 1;

    expect(isEven.value).toEqual(false);
    expect(fooSpy).toHaveBeenCalledTimes(2);
  });

  test('one dependency can depend on another', () => {
    const foo = createSignal('foo');

    const uppercaseSpy = vi.fn(() => {
      return foo.value.toUpperCase();
    });

    const toUpperCase = createDerived(uppercaseSpy, 'uppercase');

    const lowercaseSpy = vi.fn(() => {
      return toUpperCase.value.toLowerCase();
    });

    const toLowerCase = createDerived(lowercaseSpy, 'lowercase');

    foo.value = 'bar';

    expect(toUpperCase.value).toEqual('BAR');
    expect(toLowerCase.value).toEqual('bar');

    expect(uppercaseSpy).toHaveBeenCalledTimes(1);
    expect(lowercaseSpy).toHaveBeenCalledTimes(1);

    foo.value = 'baz';

    expect(toUpperCase.value).toEqual('BAZ');
    expect(toLowerCase.value).toEqual('baz');

    expect(lowercaseSpy).toHaveBeenCalledTimes(2);
    expect(uppercaseSpy).toHaveBeenCalledTimes(2);
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

    expect(spy).not.toHaveBeenCalled();
    expect(arrayLength.value).toEqual(0);
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

    const numKeys = createDerived(spy);

    expect(spy).not.toHaveBeenCalled();
    expect(numKeys.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    someObject.value.a = 1;

    expect(numKeys.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    someObject.value = { ...someObject.value, b: 2 };

    expect(numKeys.value).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('dispose unsubscribes the derived until it is read again', () => {
    const foo = createSignal(0);
    const spy = vi.fn(() => foo.value);
    const bar = createDerived(spy);

    expect(bar.value).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    bar.dispose();

    foo.value = 1;

    // while disposed, the derived is no longer notified of changes
    expect(spy).toHaveBeenCalledOnce();

    // reading it again resurrects it: it recomputes and re-subscribes
    expect(bar.value).toEqual(1);
    expect(spy).toHaveBeenCalledTimes(2);

    // and it once again reacts to subsequent changes
    foo.value = 2;
    expect(bar.value).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  test('changes propagate through a disposed and resurrected derived', () => {
    const foo = createSignal(0);
    const bar = createDerived(() => foo.value);
    const baz = createDerived(() => bar.value);

    expect(baz.value).toEqual(0);

    bar.dispose();

    // resurrect `bar` by reading it; its value hasn't changed yet
    expect(bar.value).toEqual(0);

    foo.value = 1;

    // the resurrected derived must have re-subscribed to its source, so the
    // change still cascades through it to its own observers
    expect(baz.value).toEqual(1);
  });

  test('disposing a derived that was never read does not break later reads', () => {
    const foo = createSignal(0);
    const bar = createDerived(() => foo.value);

    bar.dispose();

    expect(bar.value).toEqual(0);

    foo.value = 1;

    expect(bar.value).toEqual(1);
  });

  test('dispose does not affect other deriveds sharing the same sources', () => {
    const foo = createSignal(0);
    const spyA = vi.fn(() => foo.value);
    const spyB = vi.fn(() => foo.value);

    const a = createDerived(spyA);
    const b = createDerived(spyB);

    expect(a.value).toEqual(0);
    expect(b.value).toEqual(0);

    a.dispose();

    foo.value = 1;

    // `b` was never disposed and still reacts normally
    expect(b.value).toEqual(1);
    expect(spyB).toHaveBeenCalledTimes(2);

    // `a` did not recompute while disposed...
    expect(spyA).toHaveBeenCalledOnce();

    // ...until it is read again
    expect(a.value).toEqual(1);
    expect(spyA).toHaveBeenCalledTimes(2);
  });
});
