import { describe, test, expect } from 'vitest';
import { createDerived } from '../../src/derived';
import { createSignal } from '../../src/signal';
import { batch } from '../../src/batch';

/** return a promise that completes after a set number of milliseconds */
export function promiseDelay(timeout = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

describe('async', () => {
  test('async modify', async () => {
    return batch(async () => {
      const a = createSignal(1);
      const b = createDerived(() => a.value + 10);
      await promiseDelay(10).then(() => (a.value = 2));
      expect(b.value).toEqual(12);
    });
  });

  test('async modify in reaction before await', async () => {
    return batch(async () => {
      const s = createSignal(1);
      const a = createDerived(async () => {
        s.value = 2;
        await promiseDelay(10);
      });
      const l = createDerived(() => s.value + 100);

      a.value;
      expect(l.value).toEqual(102);
    });
  });

  test('async modify in reaction after await', async () => {
    return batch(async () => {
      const s = createSignal(1);
      const a = createDerived(async () => {
        await promiseDelay(10);
        s.value = 2;
      });
      const l = createDerived(() => s.value + 100);

      await a.value;
      expect(l.value).toEqual(102);
    });
  });
});
