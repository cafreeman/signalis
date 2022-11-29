import { describe, expect, test, vi } from 'vitest';
import { createDerived } from '../src/derived';
import { LazyReaction } from '../src/lazy-reaction';
import { createSignal } from '../src/signal';

describe('LazyReaction', () => {
  test('it works with signals', () => {
    let version = 0;
    const fnSpy = vi.fn();
    const signal = createSignal(0);

    const reaction = new LazyReaction(() => {
      version++;
      fnSpy();
    });

    reaction.trap();

    signal.value;

    reaction.seal();

    expect(fnSpy).not.toHaveBeenCalled();
    expect(version).toEqual(0);

    signal.value = 1;

    expect(fnSpy).toHaveBeenCalledOnce();
    expect(version).toEqual(1);
  });

  test.only('it works with derived', () => {
    let version = 0;
    const fnSpy = vi.fn();
    const signal = createSignal(0);
    const isOdd = createDerived(() => {
      return signal.value % 2 !== 0;
    });

    const reaction = new LazyReaction(() => {
      version++;
      fnSpy();
    });

    reaction.trap();

    isOdd.value;

    reaction.seal();

    expect(fnSpy).not.toHaveBeenCalled();
    expect(version).toEqual(0);

    signal.value = 1;

    expect(fnSpy).toHaveBeenCalledOnce();
    expect(version).toEqual(1);
  });
});
