import { describe, expect, vi, test } from 'vitest';
import { createSignal, createDerived } from '../src';
import { when } from '../src/when';

describe('when', () => {
  test('runs conditionally', () => {
    const foo = createSignal(0);

    const isOdd = createDerived(() => {
      return foo.value % 2 !== 0;
    });

    const predicateSpy = vi.fn(() => {
      return isOdd.value;
    });

    let message = '';

    const cbSpy = vi.fn(() => {
      message = 'foo is odd!!!!!!!!!!!!';
    });

    when(predicateSpy, cbSpy);

    expect(predicateSpy).toHaveBeenCalledOnce();
    expect(cbSpy).not.toHaveBeenCalled();
    expect(message).toEqual('');

    foo.value = 2;

    // Since foo.value is still even, we don't even re-evaluate the predicate again since we already
    // know it hasn't changed
    expect(predicateSpy).toHaveBeenCalledOnce();
    expect(cbSpy).not.toHaveBeenCalled();
    expect(message).toEqual('');

    foo.value = 1;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();

    foo.value = 2;
    expect(predicateSpy).toHaveBeenCalledTimes(3);
    expect(cbSpy).toHaveBeenCalledOnce();

    foo.value = 3;
    expect(predicateSpy).toHaveBeenCalledTimes(4);
    expect(cbSpy).toHaveBeenCalledTimes(2);
  });

  test('can dispose', () => {
    const foo = createSignal(0);

    const isOdd = createDerived(() => {
      return foo.value % 2 !== 0;
    });

    const predicateSpy = vi.fn(() => {
      return isOdd.value;
    });

    let message = '';

    const cbSpy = vi.fn(() => {
      message = 'foo is odd!!!!!!!!!!!!';
    });

    const dispose = when(predicateSpy, cbSpy);

    expect(predicateSpy).toHaveBeenCalledOnce();
    expect(cbSpy).not.toHaveBeenCalled();
    expect(message).toEqual('');

    foo.value = 1;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();
    expect(message).toEqual('foo is odd!!!!!!!!!!!!');

    dispose();

    foo.value = 2;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();
    expect(message).toEqual('foo is odd!!!!!!!!!!!!');

    foo.value = 1;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();
  });

  test('disposes after first run when final is true', () => {
    const foo = createSignal(0);

    const isOdd = createDerived(() => {
      return foo.value % 2 !== 0;
    });

    const predicateSpy = vi.fn(() => {
      return isOdd.value;
    });

    let message = '';

    const cbSpy = vi.fn(() => {
      message = 'foo is odd!!!!!!!!!!!!';
    });

    when(predicateSpy, cbSpy, { final: true });

    expect(predicateSpy).toHaveBeenCalledOnce();
    expect(cbSpy).not.toHaveBeenCalled();
    expect(message).toEqual('');

    foo.value = 1;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();
    expect(message).toEqual('foo is odd!!!!!!!!!!!!');

    foo.value = 2;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();
    expect(message).toEqual('foo is odd!!!!!!!!!!!!');

    foo.value = 3;

    expect(predicateSpy).toHaveBeenCalledTimes(2);
    expect(cbSpy).toHaveBeenCalledOnce();
    expect(message).toEqual('foo is odd!!!!!!!!!!!!');
  });
});
