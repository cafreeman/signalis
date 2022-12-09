import { describe, expect, test } from 'vitest';
import { createDerived } from '../../src/derived';
import { createSignal } from '../../src/signal';

describe('core reactivity', () => {
  /*
          a  b
          | /
          c
  */
  test('two signals', () => {
    const a = createSignal(7);
    const b = createSignal(1);
    let callCount = 0;

    const c = createDerived(() => {
      callCount++;
      return a.value * b.value;
    });

    a.value = 2;
    expect(c.value).toBe(2);

    b.value = 3;
    expect(c.value).toBe(6);
    expect(callCount).toBe(2);

    c.value;
    expect(callCount).toBe(2);
  });

  /*
        a  b
        | /
        c
        |
        d
  */
  test('dependent computed', () => {
    const a = createSignal(7);
    const b = createSignal(1);
    let callCount1 = 0;
    const c = createDerived(() => {
      callCount1++;
      return a.value * b.value;
    }, 'c');

    let callCount2 = 0;
    const d = createDerived(() => {
      callCount2++;
      return c.value + 1;
    }, 'd');

    expect(d.value).toBe(8);
    expect(callCount1).toBe(1);
    expect(callCount2).toBe(1);
    a.value = 3;
    expect(d.value).toBe(4);
    expect(callCount1).toBe(2);
    expect(callCount2).toBe(2);
  });

  /*
        a
        |
        c
  */
  test('equality check', () => {
    let callCount = 0;
    const a = createSignal(7);
    const c = createDerived(() => {
      callCount++;
      return a.value + 10;
    });
    c.value;
    c.value;
    expect(callCount).toBe(1);
    a.value = 7;
    expect(callCount).toBe(1); // unchanged, equality check
  });

  /*
        a     b
        |     |
        cA   cB
        |   / (dynamically depends on cB)
        cAB
  */
  test('dynamic computed', () => {
    const a = createSignal(1);
    const b = createSignal(2);
    let callCountA = 0;
    let callCountB = 0;
    let callCountAB = 0;

    const cA = createDerived(() => {
      callCountA++;
      return a.value;
    });

    const cB = createDerived(() => {
      callCountB++;
      return b.value;
    });

    const cAB = createDerived(() => {
      callCountAB++;
      return cA.value || cB.value;
    });

    expect(cAB.value).toBe(1);
    a.value = 2;
    b.value = 3;
    expect(cAB.value).toBe(2);

    expect(callCountA).toBe(2);
    expect(callCountAB).toBe(2);
    expect(callCountB).toBe(0);
    a.value = 0;
    expect(cAB.value).toBe(3);
    expect(callCountA).toBe(3);
    expect(callCountAB).toBe(3);
    expect(callCountB).toBe(1);
    b.value = 4;
    expect(cAB.value).toBe(4);
    expect(callCountA).toBe(3);
    expect(callCountAB).toBe(4);
    expect(callCountB).toBe(2);
  });

  // TBD test cleanup in api

  /*
          a
          |
          b (=)
          |
          c
  */
  test('boolean equality check', () => {
    const a = createSignal(0);
    const b = createDerived(() => a.value > 0, 'b');
    let callCount = 0;
    const c = createDerived(() => {
      callCount++;
      return b.value ? 1 : 0;
    }, 'c');

    expect(c.value).toBe(0);
    expect(callCount).toBe(1);

    a.value = 1;
    expect(c.value).toBe(1);
    expect(callCount).toBe(2);

    a.value = 2;
    expect(c.value).toBe(1);
    expect(callCount).toBe(2); // unchanged, oughtn't run because bool didn't change
  });

  /*
        s
        |
        a
        | \
        b  c
         \ |
           d
  */
  test('diamond computeds', () => {
    const s = createSignal(1);
    const a = createDerived(() => s.value, 'a');
    const b = createDerived(() => a.value * 2, 'b');
    const c = createDerived(() => a.value * 3, 'c');
    let callCount = 0;
    const d = createDerived(() => {
      callCount++;
      return b.value + c.value;
    }, 'd');
    expect(d.value).toBe(5);
    expect(callCount).toBe(1);
    s.value = 2;
    expect(d.value).toBe(10);
    expect(callCount).toBe(2);
    s.value = 3;
    expect(d.value).toBe(15);
    expect(callCount).toBe(3);
  });

  /*
        s
        |
        l  a (sets s)
  */
  test('set inside reaction', () => {
    const s = createSignal(1);
    const a = createDerived(() => (s.value = 2));
    const l = createDerived(() => s.value + 100);

    a.value;
    expect(l.value).toEqual(102);
  });
});
