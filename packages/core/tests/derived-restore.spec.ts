import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDerived } from '../src/derived.js';
import { createSignal } from '../src/signal.js';
import {
  getContextIndex,
  getCurrentContext,
  getRunningComputation,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
} from '../src/state.js';
import * as utils from '../src/utils.js';

// `reconcileSources` is internal bookkeeping, so user code can't make it throw. This file makes it
// throw to check that `Derived#compute` still restores the tracking state when its own bookkeeping
// fails, not only when the derived function does.
vi.mock('../src/utils.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils.js')>();
  return { ...original, reconcileSources: vi.fn(original.reconcileSources) };
});

describe('Derived#compute restores the tracking state', () => {
  afterEach(() => {
    setRunningComputation(null);
    setCurrentContext(null);
    setContextIndex(0);
  });

  test('when reconciling its sources throws', () => {
    const s = createSignal(0);
    const d = createDerived(() => s.value);
    const failure = new Error('reconcile');

    vi.mocked(utils.reconcileSources).mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => d.value).toThrow(failure);

    expect(getRunningComputation()).toBeNull();
    expect(getCurrentContext()).toBeNull();
    expect(getContextIndex()).toBe(0);
  });
});
