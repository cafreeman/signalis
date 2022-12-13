import { test, describe, expect } from 'vitest';
import { createDerived } from '../../src/derived';
import { createSignal } from '../../src/signal';

describe('Dynamic tests', () => {
  /*
      a  b          a
      | /     or    |
      c             c
    */
  test('dynamic sources recalculate correctly', () => {
    const a = createSignal(false);
    const b = createSignal(2);
    let count = 0;

    const c = createDerived(() => {
      count++;
      a.value || b.value;
    });

    c.value;
    expect(count).toBe(1);
    a.value = true;
    c.value;
    expect(count).toBe(2);

    b.value = 4;
    c.value;
    expect(count).toBe(2);
  });

  /*
    dependency is dynamic: sometimes l depends on b, sometimes not.
       s          s
      / \        / \
     a   b  or  a   b
      \ /        \
       l          l
    */
  test("dynamic sources don't re-execute a parent unnecessarily", () => {
    const s = createSignal(2);
    const a = createDerived(() => s.value + 1);
    let bCount = 0;
    const b = createDerived(() => {
      // b depends on s, so b's always dirty when s changes, but b may be unneeded.
      bCount++;
      return s.value + 10;
    });
    const l = createDerived(() => {
      let result = a.value;
      if (result & 0x1) {
        result += b.value; // only execute b if a is odd
      }
      return result;
    });

    expect(l.value).toEqual(15);
    expect(bCount).toEqual(1);
    s.value = 3;
    expect(l.value).toEqual(4);
    expect(bCount).toEqual(1);
  });

  /*
      s
      |
      l
    */
  test('dynamic source disappears entirely', () => {
    const s = createSignal(1);
    let done = false;
    let count = 0;

    const c = createDerived(() => {
      count++;

      if (done) {
        return 0;
      } else {
        const value = s.value;
        if (value > 2) {
          done = true; // break the link between s and c
        }
        return value;
      }
    });

    expect(c.value).toBe(1);
    expect(count).toBe(1);
    s.value = 3;
    expect(c.value).toBe(3);
    expect(count).toBe(2);

    s.value = 1; // we've now locked into 'done' state
    expect(c.value).toBe(0);
    expect(count).toBe(3);

    // we're still locked into 'done' state, and count no longer advances
    // in fact, c() will never execute again..
    s.value = 0;
    expect(c.value).toBe(0);
    expect(count).toBe(3);
  });

  test(`small dynamic graph with signal grandparents`, () => {
    const z = createSignal(3);
    const x = createSignal(0);

    const y = createSignal(0);
    const i = createDerived(() => {
      const a = y.value;
      z.value;
      if (!a) {
        return x.value;
      } else {
        return a;
      }
    });
    const j = createDerived(() => {
      const a = i.value;
      z.value;
      if (!a) {
        return x.value;
      } else {
        return a;
      }
    });
    j.value;
    x.value = 1;
    j.value;
    y.value = 1;
    j.value;
  });
});
