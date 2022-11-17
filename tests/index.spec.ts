import { describe, expect, test } from 'vitest';
import { createSignal, Derived } from '../src';

describe('Signal', () => {
  test('it works', () => {
    let foo = createSignal(0);

    let isEven = new Derived(() => {
      return foo.value % 2 === 0;
    });

    expect(isEven.value).to.be.true;

    foo.value += 1;

    expect(isEven.value).to.be.false;
  });
});
