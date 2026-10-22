import { describe, expect, test, vi } from 'vitest';
import { batch } from '../src/batch';
import { createDerived } from '../src/derived';
import { createEffect } from '../src/effect';
import { createSignal } from '../src/signal';

describe('Effect', () => {
  test('it works', () => {
    const foo = createSignal(0);

    const effectSpy = vi.fn(function () {
      foo.value;
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(3);
  });

  test('it works with derived values', () => {
    const foo = createSignal('foo');

    const uppercase = createDerived(() => {
      return foo.value.toUpperCase();
    });

    let effectValue = '';

    const effectSpy = vi.fn(() => {
      effectValue = uppercase.value;
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    foo.value = 'bar';

    expect(effectValue).toEqual('BAR');
    expect(effectSpy).toHaveBeenCalledTimes(2);

    foo.value = 'baz';

    expect(effectValue).toEqual('BAZ');
    expect(effectSpy).toHaveBeenCalledTimes(3);
  });

  test('it only recomputes when its direct dependencies have actually changed', () => {
    const foo = createSignal(0);

    const isOdd = createDerived(() => {
      return foo.value % 2 !== 0;
    });

    const effectSpy = vi.fn(() => {
      isOdd.value;
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    foo.value = 1;

    expect(effectSpy).toHaveBeenCalledTimes(2);

    foo.value = 3;

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('it works with multiple derived values', () => {
    const firstName = createSignal('john');
    const lastName = createSignal('smith');

    const firstNameUppercase = createDerived(() => {
      return firstName.value.toUpperCase();
    });

    const lastNameUppercase = createDerived(() => {
      return lastName.value.toUpperCase();
    });

    const fullName = createDerived(() => {
      return `${firstNameUppercase.value} ${lastNameUppercase.value}`;
    });

    let effectValue = '';

    const effectSpy = vi.fn(() => {
      effectValue = `Combining ${firstNameUppercase.value} and ${lastNameUppercase.value} to create ${fullName.value}`;
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    firstName.value = 'jane';

    expect(effectSpy).toHaveBeenCalledTimes(2);

    expect(effectValue).toEqual('Combining JANE and SMITH to create JANE SMITH');
  });

  test('it only recomputes when relevant dependencies have changed', () => {
    const foo = createSignal('foo');
    const bar = createSignal('bar');

    const uppercaseFoo = createDerived(() => {
      return foo.value.toUpperCase();
    });

    const uppercaseBar = createDerived(() => {
      return bar.value.toUpperCase();
    });

    let effectValue = '';

    const effectSpy = vi.fn(() => {
      effectValue = uppercaseBar.value;
    });

    createEffect(effectSpy);

    expect(effectSpy).toHaveBeenCalledOnce();

    foo.value = 'blah';

    expect(effectValue).toEqual('BAR');
    expect(effectSpy).toHaveBeenCalledOnce();

    uppercaseFoo.value;

    expect(effectSpy).toHaveBeenCalledOnce();

    bar.value = 'baz';

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(effectValue).toEqual('BAZ');
  });

  test('can dispose', () => {
    const foo = createSignal(0);

    const effectSpy = vi.fn(() => {
      foo.value;
    });

    const dispose = createEffect(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);

    dispose();

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('can dispose with a custom cleanup function', () => {
    const foo = createSignal(0);

    let didCleanup = false;

    const cleanupSpy = vi.fn(() => {
      didCleanup = true;
    });

    const effectSpy = vi.fn(() => {
      foo.value;

      return cleanupSpy;
    });

    const dispose = createEffect(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(didCleanup).to.be.false;

    dispose();

    expect(cleanupSpy).toHaveBeenCalledOnce();

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(didCleanup).to.be.true;
  });

  test.todo('does not allow cycles', () => {
    const foo = createSignal(0);
    const effectSpy = vi.fn(() => {
      foo.value++;
    });

    const effectWrapper = () => {
      createEffect(effectSpy);

      foo.value++;
    };

    effectWrapper();

    expect(effectSpy).not.toHaveBeenCalled();

    // TODO we really need an error or warning or something here rather than just making the effect
    // totally inert
    // expect(effectWrapper).toThrowError(
    //   'cannot update a signal that is being used during a computation.'
    // );
  });

  // Effects run in the order that STALE marking schedules their reactions, so changes to how marks
  // propagate through the graph must leave this order alone
  test('effects and derived computations run in a stable order through a branching graph', () => {
    const log: Array<string> = [];
    const s = createSignal(0);
    const t = createSignal(0);

    const a = createDerived(() => (log.push('a'), s.value + 1));
    const b = createDerived(() => (log.push('b'), s.value * 2));
    const c = createDerived(() => (log.push('c'), a.value + 1));
    // `d` is a diamond: it is reachable from `s` through both `a` and `b`
    const d = createDerived(() => (log.push('d'), a.value + b.value + t.value));
    const e = createDerived(() => (log.push('e'), c.value + d.value));
    // No effect reads `u`, so outside a batch it is still STALE when the next write arrives
    const u = createDerived(() => (log.push('u'), a.value + d.value));

    createEffect(() => {
      log.push(`fx1:${c.value}`);
    });
    createEffect(() => {
      log.push(`fx2:${d.value}`);
    });
    createEffect(() => {
      log.push(`fx3:${b.value}:${e.value}`);
    });
    createEffect(() => {
      log.push(`fx4:${s.value}`);
    });
    u.value;

    log.length = 0;

    s.value = 1;
    s.value = 2;
    t.value = 1;
    batch(() => {
      s.value = 3;
      t.value = 2;
      s.value = 4;
    });
    batch(() => {
      t.value = 3;
    });
    s.value = 5;

    expect(log).toEqual([
      'fx4:1',
      'a',
      'd',
      'b',
      'fx2:4',
      'e',
      'c',
      'fx3:2:7',
      'fx1:3',
      'fx4:2',
      'a',
      'd',
      'b',
      'fx2:7',
      'e',
      'c',
      'fx3:4:11',
      'fx1:4',
      'd',
      'e',
      'fx3:4:12',
      'fx2:8',
      'fx4:4',
      'd',
      'a',
      'b',
      'fx2:15',
      'e',
      'c',
      'fx3:8:21',
      'fx1:6',
      'd',
      'e',
      'fx3:8:22',
      'fx2:16',
      'fx4:5',
      'a',
      'd',
      'b',
      'fx2:19',
      'e',
      'c',
      'fx3:10:26',
      'fx1:7',
    ]);
  });
});
