import { describe, expect, test, vi } from 'vitest';
import { batch } from '../src/batch';
import { createDerived } from '../src/derived';
import { createEffect } from '../src/effect';
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

  test('dispose invalidates dependents instead of leaving them stale', () => {
    const foo = createSignal(0);
    const bar = createDerived(() => foo.value);
    const baz = createDerived(() => bar.value);

    expect(baz.value).toEqual(0);

    bar.dispose();

    foo.value = 1;

    // `bar` is disposed and never read again, but `baz` must not serve its
    // stale cached value: disposal should mark dependents stale so their next
    // read revalidates (which resurrects `bar` on its next compute)
    expect(baz.value).toEqual(1);
  });

  test('dispose invalidates dependents for reads inside a batch', () => {
    const foo = createSignal(0);
    const sibling = createSignal(0);
    const bar = createDerived(() => foo.value);
    const baz = createDerived(() => bar.value + sibling.value);

    expect(baz.value).toEqual(0);

    batch(() => {
      foo.value = 1;
      sibling.value = 5;
      bar.dispose();

      // The dependent must observe both pending writes when it is read before
      // the batch finishes. A stale-only invalidation returns the old cache.
      expect(baz.value).toEqual(6);
    });
  });

  test('can defer source subscriptions until a render commits', () => {
    const foo = createSignal(0);
    const bar = createDerived(() => foo.value);

    bar._beginSourceCollection();
    expect(bar.value).toEqual(0);

    expect(foo._observers).toBeNull();

    bar._commitSourceCollection();
    expect(foo._observers).toEqual([bar]);
  });

  test('retains pending sources when collection restarts before commit', () => {
    const foo = createSignal(0);
    const bar = createDerived(() => foo.value);

    bar._beginSourceCollection();
    expect(bar.value).toEqual(0);

    // A render may restart before passive effects commit. The second
    // collection has no computation because the derived is already clean, so
    // it must not discard the first render's pending sources.
    bar._beginSourceCollection();
    bar._commitSourceCollection();

    expect(foo._observers).toEqual([bar]);
  });

  test('preserves unchanged leading sources during deferred commits', () => {
    const first = createSignal(0);
    const previous = createSignal(0);
    const next = createSignal(0);
    let second = previous;
    const total = createDerived(() => first.value + second.value);

    expect(total.value).toEqual(0);

    total._beginSourceCollection();
    second = next;
    first.value = 1;
    expect(total.value).toEqual(1);
    total._commitSourceCollection();

    expect(first._observers).toEqual([total]);
    expect(previous._observers).toEqual([]);
    expect(next._observers).toEqual([total]);
  });

  test('revalidates after a deferred commit links it to an invalidated source', () => {
    const source = createSignal(1);
    const doubled = createDerived(() => source.value * 2);
    const total = createDerived(() => doubled.value + 1);

    total._beginSourceCollection();
    expect(total.value).toEqual(3);

    // Written between "render" and "commit": `doubled` is already subscribed to `source`, so it
    // goes DIRTY, but `total` isn't linked to it yet and hears nothing
    source.value = 2;

    total._commitSourceCollection();
    expect(total.value).toEqual(5);
  });

  test('propagates through a node that goes from STALE to DIRTY', () => {
    // `bottom` is marked STALE through `middle` first, then DIRTY directly by `right`'s change. Its
    // observers only hear about the first transition, which must be enough for them to update
    const left = createSignal(1);
    const right = createSignal(1);
    const middle = createDerived(() => left.value * 2);
    const bottom = createDerived(() => middle.value + right.value);
    const top = createDerived(() => bottom.value * 10);

    const values: Array<number> = [];
    createEffect(() => {
      values.push(top.value);
    });

    batch(() => {
      left.value = 2;
      right.value = 2;
    });
    right.value = 3;
    left.value = 3;

    expect(values).toEqual([30, 60, 70, 90]);
  });

  test('marking propagates through a diamond and a deep chain to effects at every depth', () => {
    const head = createSignal(0);
    const chain = [createDerived(() => head.value + 1)];
    // Reading each node as it's built keeps the first computes shallow
    chain[0]!.value;
    for (let i = 1; i < 300; i++) {
      const previous = chain[i - 1]!;
      const node = createDerived(() => previous.value + 1);
      node.value;
      chain.push(node);
    }

    const tail = chain[299]!;
    const left = createDerived(() => tail.value * 2);
    const right = createDerived(() => tail.value * 3);
    const join = createDerived(() => left.value + right.value);

    const seen = {
      middle: [] as Array<number>,
      tail: [] as Array<number>,
      join: [] as Array<number>,
    };
    createEffect(() => {
      seen.middle.push(chain[150]!.value);
    });
    createEffect(() => {
      seen.tail.push(tail.value);
    });
    createEffect(() => {
      seen.join.push(join.value);
    });

    head.value = 10;
    head.value = 20;

    expect(seen.middle).toEqual([151, 161, 171]);
    expect(seen.tail).toEqual([300, 310, 320]);
    expect(seen.join).toEqual([1500, 1550, 1600]);
  });

  test('writing a signal marks a chain deeper than the call stack without throwing', () => {
    const head = createSignal(0);
    let previous = createDerived(() => head.value);
    previous.value;
    for (let i = 1; i < 50_000; i++) {
      const upstream = previous;
      previous = createDerived(() => upstream.value + 1);
      previous.value;
    }

    // Nothing reads the tail, so only the marking walks the chain; a read would recurse through it
    expect(() => {
      head.value = 1;
    }).not.toThrow();
  });

  test('reading a clean derived repeatedly does not rerun its computation', () => {
    const count = createSignal(1);
    const computeSpy = vi.fn(() => count.value * 2);
    const double = createDerived(computeSpy);

    expect(double.value).toEqual(2);
    expect(double.value).toEqual(2);
    expect(double.value).toEqual(2);
    expect(computeSpy).toHaveBeenCalledOnce();

    count.value = 2;

    expect(double.value).toEqual(4);
    expect(double.value).toEqual(4);
    expect(computeSpy).toHaveBeenCalledTimes(2);
  });

  test('reading a derived inside a batch reflects a write made earlier in the batch', () => {
    const count = createSignal(1);
    const double = createDerived(() => count.value * 2);
    const plusOne = createDerived(() => double.value + 1);

    expect(plusOne.value).toEqual(3);

    batch(() => {
      count.value = 5;

      expect(double.value).toEqual(10);
      expect(plusOne.value).toEqual(11);
    });

    expect(plusOne.value).toEqual(11);
  });

  test('marking downstream nodes STALE never downgrades one that a write already marked DIRTY', () => {
    const source = createSignal(0);
    const useGate = createSignal(false);
    const gate = createDerived(() => source.value > 100);
    const dependent = createDerived(() => source.value + (useGate.value && gate.value ? 1 : 0));
    const seen: Array<number> = [];

    createEffect(() => {
      seen.push(dependent.value);
    });

    // Reading `gate` for the first time links it to `source` after `dependent`, so a write to
    // `source` marks `dependent` DIRTY first and then marks `gate` DIRTY, whose walk reaches
    // `dependent` again
    useGate.value = true;
    source.value = 1;

    expect(seen).toEqual([0, 1]);
  });
});
