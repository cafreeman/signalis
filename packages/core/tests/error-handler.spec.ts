import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { batch } from '../src/batch.js';
import { createEffect } from '../src/effect.js';
import { setErrorHandler } from '../src/error.js';
import { createResource } from '../src/resource.js';
import { createSignal } from '../src/signal.js';
import { when } from '../src/when.js';

function boom(message = 'boom'): Error {
  return new Error(message);
}

describe('setErrorHandler', () => {
  let errors: Array<unknown>;
  let infos: Array<{ source: string }>;
  let restore: () => void;

  beforeEach(() => {
    errors = [];
    infos = [];
    restore = setErrorHandler((error, info) => {
      errors.push(error);
      infos.push(info);
    });
  });

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('a write', () => {
    test('does not throw when an effect throws on a later run', () => {
      const s = createSignal(0);
      const error = boom();

      createEffect(() => {
        if (s.value > 0) {
          throw error;
        }
      });

      expect(() => {
        s.value = 1;
      }).not.toThrow();

      expect(errors).toEqual([error]);
    });

    test('a different effect throwing during an effect’s own write leaves the writer alive', () => {
      const trigger = createSignal(0);
      const x = createSignal(0);
      let writer = 0;

      createEffect(() => {
        writer++;
        if (trigger.value > 0) {
          x.value = trigger.value;
        }
      });
      createEffect(() => {
        if (x.value === 1) {
          throw boom();
        }
      });

      expect(() => {
        trigger.value = 1;
      }).not.toThrow();
      expect(writer).toBe(2);
      expect(errors).toHaveLength(1);

      trigger.value = 2;
      expect(writer).toBe(3);
    });
  });

  describe('batch', () => {
    test('returns normally when an effect throws as the batch ends', () => {
      const s = createSignal(0);
      const other = vi.fn();

      createEffect(() => {
        if (s.value > 0) {
          other();
        }
      });
      createEffect(() => {
        if (s.value > 0) {
          throw boom();
        }
      });

      expect(() =>
        batch(() => {
          s.value = 1;
        }),
      ).not.toThrow();

      expect(other).toHaveBeenCalledOnce();
      expect(errors).toHaveLength(1);
    });

    test('E5: the callback’s error wins over an effect’s error', () => {
      const s = createSignal(0);
      const effectError = boom('effect');
      const callbackError = boom('cb');
      const spy = vi.fn(() => {
        if (s.value > 0) {
          throw effectError;
        }
      });
      createEffect(spy);

      expect(() =>
        batch(() => {
          s.value = 1;
          throw callbackError;
        }),
      ).toThrow(callbackError);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(errors).toEqual([effectError]);
    });

    test('a callback that throws still runs the effect once with the written value', () => {
      const s = createSignal(0);
      const seen: Array<number> = [];

      createEffect(() => {
        seen.push(s.value);
      });

      expect(() =>
        batch(() => {
          s.value = 1;
          throw boom('cb');
        }),
      ).toThrow('cb');

      expect(seen).toEqual([0, 1]);
    });
  });

  test('receives the error once, with the source of the construct that threw', () => {
    const s = createSignal(0);
    const effectError = boom('effect');
    const whenError = boom('when');

    createEffect(() => {
      if (s.value > 0) {
        throw effectError;
      }
    });
    when(
      () => s.value > 0,
      () => {
        throw whenError;
      },
    );

    s.value = 1;

    expect(errors).toHaveLength(2);
    expect(errors).toContain(effectError);
    expect(errors).toContain(whenError);
    expect(infos[errors.indexOf(effectError)]).toEqual({ source: 'effect' });
    expect(infos[errors.indexOf(whenError)]).toEqual({ source: 'when' });
  });

  test('returns a function that restores the previous handler', () => {
    const s = createSignal(0);
    const second: Array<unknown> = [];
    const restoreSecond = setErrorHandler((error) => {
      second.push(error);
    });

    createEffect(() => {
      if (s.value > 0) {
        throw boom();
      }
    });

    s.value = 1;
    expect(second).toHaveLength(1);
    expect(errors).toHaveLength(0);

    restoreSecond();

    s.value = 2;
    expect(second).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  describe('without a handler', () => {
    // Capture the callbacks queued with `queueMicrotask` so the test can run them itself, instead of
    // letting a real uncaught error reach the test runner
    function captureMicrotasks() {
      const tasks: Array<() => void> = [];
      vi.stubGlobal('reportError', undefined);
      vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
        tasks.push(task);
      });
      return tasks;
    }

    test('the error is thrown asynchronously and the write returns normally', () => {
      restore();
      restore = () => {};
      const tasks = captureMicrotasks();
      const s = createSignal(0);
      const error = boom();

      createEffect(() => {
        if (s.value > 0) {
          throw error;
        }
      });

      expect(() => {
        s.value = 1;
      }).not.toThrow();

      expect(tasks).toHaveLength(1);
      expect(() => tasks[0]!()).toThrow(error);
    });

    test('passing null removes the handler', () => {
      const tasks = captureMicrotasks();
      const clear = setErrorHandler(null);
      const s = createSignal(0);

      createEffect(() => {
        if (s.value > 0) {
          throw boom();
        }
      });
      s.value = 1;

      expect(errors).toHaveLength(0);
      expect(tasks).toHaveLength(1);

      clear();
    });

    test('uses reportError when the environment has it', () => {
      restore();
      restore = () => {};
      const report = vi.fn();
      vi.stubGlobal('reportError', report);
      const s = createSignal(0);
      const error = boom();

      createEffect(() => {
        if (s.value > 0) {
          throw error;
        }
      });
      s.value = 1;

      expect(report).toHaveBeenCalledWith(error);
    });
  });

  test('a handler that throws does not stop the remaining effects, and its error is thrown asynchronously', () => {
    const tasks: Array<() => void> = [];
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => {
      tasks.push(task);
    });
    const handlerError = boom('handler');
    restore();
    restore = setErrorHandler(() => {
      throw handlerError;
    });

    const s = createSignal(0);
    const sibling = vi.fn();

    createEffect(() => {
      if (s.value > 0) {
        sibling();
      }
    });
    createEffect(() => {
      if (s.value > 0) {
        throw boom();
      }
    });

    expect(() => {
      s.value = 1;
    }).not.toThrow();

    expect(sibling).toHaveBeenCalledOnce();
    expect(tasks).toHaveLength(1);
    expect(() => tasks[0]!()).toThrow(handlerError);
  });

  test('E12: an effect that throws on a resource’s value goes to the handler, not resource.error', async () => {
    const effectError = boom('effect');
    const resource = createResource(() => Promise.resolve(5));

    createEffect(() => {
      if (resource.value === 5) {
        throw effectError;
      }
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(resource.value).toBe(5);
    expect(errors).toEqual([effectError]);
    expect(resource.error.value).toBeNull();
  });
});
