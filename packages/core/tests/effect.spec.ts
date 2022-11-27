import { describe, expect, test, vi } from 'vitest';
import { createDerived, createSignal } from '../src';
import { createEffect, Effect } from '../src/effect';

describe('Effect', () => {
  test('it works', () => {
    const foo = createSignal(0);

    const effectSpy = vi.fn(() => {
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

    createEffect(effectSpy, [isOdd]);

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

  test('multiple related effects', () => {
    const foo = createSignal(0);

    let effect!: Effect;

    let effect1: number;
    let effect2: number;

    createEffect(function (this: Effect) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      effect = this;
      effect1 = foo.value;
    });

    createEffect(() => {
      effect2 = foo.value;
    });

    expect(effect1!).toEqual(0);
    expect(effect2!).toEqual(0);

    foo.value = 1;

    expect(effect1!).toEqual(1);
    expect(effect2!).toEqual(1);
  });

  test('can dispose', () => {
    const foo = createSignal(0);

    const effectSpy = vi.fn(() => {
      foo.value;
    });

    const dispose = createEffect(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);

    expect(dispose()).to.be.true;

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
  });

  test('can dispose with a custom cleanup function', () => {
    const foo = createSignal(0);

    let didCleanup = false;

    const effectSpy = vi.fn(() => {
      foo.value;
      return () => {
        didCleanup = true;
      };
    });

    const dispose = createEffect(effectSpy);

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(didCleanup).to.be.false;

    expect(dispose()).to.be.true;

    foo.value++;

    expect(effectSpy).toHaveBeenCalledTimes(2);
    expect(didCleanup).to.be.true;
  });

  test('prevents you from mutating dependencies inside of an effect in order to prevent cycles', () => {
    const foo = createSignal(0);

    const effectWrapper = () => {
      createEffect(() => {
        foo.value++;
      });

      foo.value++;
    };

    expect(effectWrapper).toThrowError(
      'Cannot update a tag that has been used during a computation.'
    );
  });
});
