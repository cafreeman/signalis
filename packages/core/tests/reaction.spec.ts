import { describe, expect, test, vi } from 'vitest';
import { createDerived } from '../src/derived';
import { Reaction } from '../src/reaction';
import { createSignal } from '../src/signal';

describe('reaction', () => {
  test('it works', () => {
    const foo = createSignal(0);

    let result!: number;

    const spy = vi.fn(() => {
      result = foo.value;
    });

    new Reaction(spy);

    expect(result).toEqual(0);
    expect(spy).toHaveBeenCalledOnce();

    foo.value = 2;

    expect(result).toEqual(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('it works with derived values', () => {
    const foo = createSignal(0);
    const isOdd = createDerived(() => {
      return foo.value % 2 !== 0;
    });

    let result!: boolean;

    const spy = vi.fn(() => {
      result = isOdd.value;
    });

    new Reaction(spy);

    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledOnce();

    foo.value = 1;

    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);

    foo.value = 2;
    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  test('it only recomputes when its direct dependencies have actually changed', () => {
    const foo = createSignal(0);

    const isOdd = createDerived(() => {
      return foo.value % 2 !== 0;
    });

    const effectSpy = vi.fn(() => {
      isOdd.value;
    });

    new Reaction(effectSpy);

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

    new Reaction(effectSpy);

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

    new Reaction(effectSpy);

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

    const reaction = new Reaction(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);

    reaction.dispose();

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('can dispose with a custom cleanup function', () => {
    const foo = createSignal(0);

    let didCleanup = false;

    const effectSpy = vi.fn(() => {
      foo.value;
    });

    const reaction = new Reaction(effectSpy, () => (didCleanup = true));

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(didCleanup).toBe(false);

    reaction.dispose();

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(didCleanup).toBe(true);
  });

  test('prevents you from mutating dependencies inside of an effect in order to prevent cycles', () => {
    const foo = createSignal(0);

    const effectWrapper = () => {
      new Reaction(() => {
        foo.value++;
      });

      foo.value++;
    };

    expect(effectWrapper).toThrowError(
      'Cannot update a tag that has been used during a computation.'
    );
  });
});
