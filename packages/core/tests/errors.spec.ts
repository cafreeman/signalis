import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { batch } from '../src/batch.js';
import { createDerived } from '../src/derived.js';
import { createEffect } from '../src/effect.js';
import { setErrorHandler } from '../src/error.js';
import { createSignal } from '../src/signal.js';
import {
  runReactions,
  setContextIndex,
  setCurrentContext,
  setRunningComputation,
  getRunningComputation,
} from '../src/state.js';
import { createStore } from '../src/store.js';
import { untrack } from '../src/untrack.js';
import { update } from '../src/update.js';
import { when } from '../src/when.js';

// Run `fn` and swallow whatever it throws. Today an effect's error escapes through the write that
// triggered it, so the tests that are about what the graph looks like afterwards wrap their writes
// in this, to fail on a wrong state or count instead of on the error itself
function attempt(fn: () => void): void {
  try {
    fn();
  } catch {
    // Intentionally empty
  }
}

function boom(message = 'boom'): Error {
  return new Error(message);
}

let restoreHandler: () => void;

beforeEach(() => {
  // These tests make effects throw on purpose, and none of them is about where the error goes
  restoreHandler = setErrorHandler(() => {});
});

afterEach(() => {
  restoreHandler();

  // A derived that throws leaks the tracking globals, and a thrown effect can leave reactions in
  // the module-level queue; neither may spill into the next test
  setRunningComputation(null);
  setCurrentContext(null);
  setContextIndex(0);

  for (;;) {
    try {
      runReactions();
      break;
    } catch {
      // Keep draining
    }
  }
});

describe('a throw does not break the graph', () => {
  describe('E1: an effect that throws runs again', () => {
    test('when a source it read changes', () => {
      const s = createSignal(0);
      let calls = 0;

      createEffect(() => {
        const v = s.value;
        calls++;
        if (v === 1) {
          throw boom();
        }
      });

      attempt(() => {
        s.value = 1;
      });
      expect(calls).toBe(2);

      attempt(() => {
        s.value = 2;
      });
      expect(calls).toBe(3);

      attempt(() => {
        s.value = 3;
      });
      expect(calls).toBe(4);
    });

    test('inside a batch', () => {
      const s = createSignal(0);
      let calls = 0;

      createEffect(() => {
        const v = s.value;
        calls++;
        if (v === 1) {
          throw boom();
        }
      });

      attempt(() => {
        batch(() => {
          s.value = 1;
        });
      });
      expect(calls).toBe(2);

      attempt(() => {
        batch(() => {
          s.value = 2;
        });
      });
      expect(calls).toBe(3);
    });
  });

  test('an effect subscribes to the sources it read before it threw', () => {
    const mode = createSignal(0);
    const a = createSignal(0);
    const b = createSignal(0);
    let calls = 0;

    createEffect(() => {
      calls++;
      if (mode.value === 0) {
        a.value;
      } else {
        b.value;
        throw boom();
      }
    });

    attempt(() => {
      mode.value = 1;
    });
    expect(calls).toBe(2);

    // `b` was first read by the run that threw, and `a` was dropped by it
    attempt(() => {
      b.value = 1;
    });
    expect(calls).toBe(3);

    attempt(() => {
      a.value = 1;
    });
    expect(calls).toBe(3);
  });

  test('an effect that writes its own source is not scheduled again by that write', () => {
    const s = createSignal(0);
    let calls = 0;

    createEffect(() => {
      calls++;
      if (s.value === 1) {
        s.value = 2;
      }
    });

    s.value = 1;

    expect(calls).toBe(2);
    expect(s.value).toBe(2);
  });

  test('E2: an effect over a derived that throws once recovers when the derived succeeds', () => {
    const s = createSignal(0);
    const d = createDerived(() => {
      const v = s.value;
      if (v === 1) {
        throw boom();
      }
      return v;
    });

    let calls = 0;
    let last = -1;

    createEffect(() => {
      last = d.value;
      calls++;
    });

    expect(calls).toBe(1);

    attempt(() => {
      s.value = 1;
    });
    attempt(() => {
      s.value = 2;
    });

    expect(calls).toBe(2);
    expect(last).toBe(2);
  });

  describe('E3: a sibling effect still runs in the same flush as a thrower', () => {
    function setup() {
      const s = createSignal(0);
      const sibling = vi.fn();

      // Effects run last in, first out, so the one created second (the thrower) runs first
      createEffect(() => {
        if (s.value === 1) {
          sibling();
        }
      });
      createEffect(() => {
        if (s.value === 1) {
          throw boom();
        }
      });

      return { s, sibling };
    }

    test('outside a batch', () => {
      const { s, sibling } = setup();

      attempt(() => {
        s.value = 1;
      });

      expect(sibling).toHaveBeenCalledOnce();
    });

    test('inside a batch', () => {
      const { s, sibling } = setup();

      attempt(() => {
        batch(() => {
          s.value = 1;
        });
      });

      expect(sibling).toHaveBeenCalledOnce();
    });
  });

  test('E4: an effect that writes a signal stays alive when another effect throws in the nested flush', () => {
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

    attempt(() => {
      trigger.value = 1;
    });
    expect(writer).toBe(2);

    attempt(() => {
      trigger.value = 2;
    });
    expect(writer).toBe(3);
  });

  test('E6: a derived that throws at the top level is no longer the running computation', () => {
    const d = createDerived(() => {
      throw boom();
    });

    expect(() => d.value).toThrow('boom');
    expect(getRunningComputation()).toBeNull();
  });

  test('a read after a derived threw at the top level is not tracked by the derived', () => {
    const s = createSignal(0);
    const other = createSignal(0);
    const d = createDerived(() => {
      s.value;
      throw boom();
    });

    expect(() => d.value).toThrow('boom');
    other.value;

    expect(d._sources).toEqual([s]);
    expect(other._observers?.length ?? 0).toBe(0);
  });

  describe('E7: catching a derived value error inside an effect', () => {
    function setup() {
      const s = createSignal(0);
      const hidden = createSignal(0);
      const other = createSignal(0);
      const d = createDerived(() => {
        hidden.value;
        if (s.value === 2) {
          throw boom();
        }
        return 1;
      });
      let calls = 0;

      createEffect(() => {
        calls++;
        s.value;
        try {
          d.value;
        } catch {
          // The effect handles the error itself
        }
        other.value;
      });

      return { s, hidden, other, calls: () => calls };
    }

    test('later run: a signal only the derived reads re-runs the effect', () => {
      const { s, hidden, calls } = setup();

      s.value = 2;
      expect(calls()).toBe(2);

      hidden.value = 5;
      expect(calls()).toBe(3);
    });

    test('later run: the effect still re-runs on a signal it read itself (guard)', () => {
      const { s, other, calls } = setup();

      s.value = 2;
      expect(calls()).toBe(2);

      other.value = 1;
      expect(calls()).toBe(3);
    });

    test('E7b, first run: the effect keeps the signal it read before the derived threw', () => {
      // `d` reads only `hidden` before it throws, so its reads must not replace the effect's own
      const s = createSignal(0);
      const hidden = createSignal(0);
      const other = createSignal(0);
      const d = createDerived(() => {
        hidden.value;
        throw boom();
      });
      let calls = 0;

      createEffect(() => {
        calls++;
        s.value;
        try {
          d.value;
        } catch {
          // The effect handles the error itself
        }
        other.value;
      });

      s.value = 1;
      expect(calls).toBe(2);
    });
  });

  test('E11: a derived that catches an inner derived error keeps all of its sources', () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const inner = createDerived(() => {
      throw boom('inner');
    });
    const outer = createDerived(() => {
      a.value;
      try {
        inner.value;
      } catch {
        // The derived handles the error itself
      }
      return b.value;
    });

    outer.value;

    expect(outer._sources).toEqual([a, inner, b]);
  });

  test('E9: a final when whose callback throws is disposed', () => {
    const s = createSignal(0);

    when(
      () => s.value > 0,
      () => {
        throw boom();
      },
      { final: true },
    );

    attempt(() => {
      s.value = 1;
    });

    expect(s._observers?.length ?? 0).toBe(0);
  });

  test('a cleanup that throws propagates to the disposer’s caller and leaves the effect unsubscribed', () => {
    const s = createSignal(0);
    const error = boom('cleanup');
    const calls = vi.fn();
    const dispose = createEffect(() => {
      s.value;
      calls();
      return () => {
        throw error;
      };
    });

    expect(() => dispose()).toThrow(error);
    expect(s._observers?.length ?? 0).toBe(0);

    s.value = 1;
    expect(calls).toHaveBeenCalledOnce();

    // A second call is a no-op, so the cleanup does not throw again
    expect(() => dispose()).not.toThrow();
  });

  test('a final when whose callback throws on the first check throws the callback’s error', () => {
    const s = createSignal(1);
    const error = boom('callback');
    const callback = vi.fn(() => {
      throw error;
    });

    expect(() => when(() => s.value > 0, callback, { final: true })).toThrow(error);

    expect(callback).toHaveBeenCalledOnce();
    expect(s._observers?.length ?? 0).toBe(0);
  });

  test('a when whose predicate throws on the first check throws the predicate’s error', () => {
    const s = createSignal(1);
    const error = boom('predicate');

    expect(() =>
      when(
        () => {
          s.value;
          throw error;
        },
        () => {},
      ),
    ).toThrow(error);

    expect(s._observers?.length ?? 0).toBe(0);
  });

  test('a when whose callback throws on the first check throws the callback’s error and is disposed', () => {
    const s = createSignal(1);
    const error = boom('callback');
    const callback = vi.fn(() => {
      throw error;
    });

    expect(() => when(() => s.value > 0, callback)).toThrow(error);
    expect(s._observers?.length ?? 0).toBe(0);

    s.value = 2;
    expect(callback).toHaveBeenCalledOnce();
  });

  test('a final when’s callback runs at most once when it throws on a later check', () => {
    const s = createSignal(0);
    const callback = vi.fn(() => {
      throw boom();
    });

    when(() => s.value > 0, callback, { final: true });

    s.value = 1;
    s.value = 2;

    expect(callback).toHaveBeenCalledOnce();
  });

  test('E13: disposing twice runs the cleanup once', () => {
    const s = createSignal(0);
    const cleanup = vi.fn();
    const dispose = createEffect(() => {
      s.value;
      return cleanup;
    });

    dispose();
    dispose();

    expect(cleanup).toHaveBeenCalledOnce();
  });
});

describe('behavior that is already correct and must stay so', () => {
  test('a derived value read inside try/catch throws the function’s error', () => {
    const error = boom();
    const d = createDerived(() => {
      throw error;
    });
    let caught: unknown;

    try {
      d.value;
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(error);
  });

  test('E8: createEffect throws a first-run error and leaves nothing subscribed', () => {
    const s = createSignal(0);
    let calls = 0;
    const error = boom();

    expect(() =>
      createEffect(() => {
        calls++;
        s.value;
        if (calls === 1) {
          throw error;
        }
      }),
    ).toThrow(error);

    expect(s._observers?.length ?? 0).toBe(0);

    s.value = 1;
    expect(calls).toBe(1);
  });

  test('a batch callback’s error propagates', () => {
    const error = boom('cb');

    expect(() =>
      batch(() => {
        throw error;
      }),
    ).toThrow(error);
  });

  test('isEqual throwing leaves the signal unchanged', () => {
    const s = createSignal(1, () => {
      throw boom('isEqual');
    });
    const spy = vi.fn(() => {
      s.value;
    });
    createEffect(spy);

    expect(() => {
      s.value = 2;
    }).toThrow('isEqual');

    expect(s.value).toBe(1);
    expect(spy).toHaveBeenCalledOnce();
  });

  test('untrack restores tracking after a throw', () => {
    const s = createSignal(0);
    const spy = vi.fn(() => {
      attempt(() => {
        untrack(() => {
          throw boom();
        });
      });
      s.value;
    });
    createEffect(spy);

    s.value = 1;

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('E10: an update recipe that throws still runs the effects of its writes once', () => {
    const store = createStore({ a: 1 });
    const seen: Array<number> = [];

    createEffect(() => {
      seen.push(store.a);
    });

    expect(() =>
      update(store, (draft) => {
        draft.a = 2;
        throw boom('recipe');
      }),
    ).toThrow('recipe');

    expect(seen).toEqual([1, 2]);
  });
});

describe('a derived that throws caches its error', () => {
  test('repeated reads rethrow the same error without running the function again', () => {
    const error = boom();
    const fn = vi.fn(() => {
      throw error;
    });
    const d = createDerived(fn);

    expect(() => d.value).toThrow(error);
    expect(() => d.value).toThrow(error);
    expect(() => d.value).toThrow(error);

    expect(fn).toHaveBeenCalledOnce();
  });

  test('it recovers when a source it read changes', () => {
    const s = createSignal(0);
    const fn = vi.fn(() => {
      const v = s.value;
      if (v === 1) {
        throw boom();
      }
      return v;
    });
    const d = createDerived(fn);

    expect(d.value).toBe(0);

    s.value = 1;
    expect(() => d.value).toThrow('boom');
    expect(() => d.value).toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);

    s.value = 2;
    expect(d.value).toBe(2);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('a dependent effect sees the recovery', () => {
    const s = createSignal(0);
    const d = createDerived(() => {
      const v = s.value;
      if (v === 1) {
        throw boom();
      }
      return v;
    });
    const seen: Array<number> = [];

    createEffect(() => {
      try {
        seen.push(d.value);
      } catch {
        seen.push(-1);
      }
    });

    attempt(() => {
      s.value = 1;
    });
    attempt(() => {
      s.value = 2;
    });

    expect(seen).toEqual([0, -1, 2]);
  });

  test('dispose clears a cached error', () => {
    let fail = true;
    const fn = vi.fn(() => {
      if (fail) {
        throw boom();
      }
      return 'ok';
    });
    const d = createDerived(fn);

    expect(() => d.value).toThrow('boom');

    fail = false;
    d.dispose();

    expect(d.value).toBe('ok');
  });

  test('a dependent re-runs when a disposed errored derived recovers to its earlier value', () => {
    const s = createSignal(0);
    const d = createDerived(() => {
      if (s.value === 1) {
        throw boom();
      }
      return 'same';
    });
    const seen: Array<string> = [];

    createEffect(() => {
      try {
        seen.push(d.value);
      } catch {
        seen.push('error');
      }
    });

    s.value = 1;
    expect(seen).toEqual(['same', 'error']);

    batch(() => {
      s.value = 0;
      d.dispose();
    });

    expect(seen).toEqual(['same', 'error', 'same']);
  });

  test('a derived that throws a promise recomputes and re-runs its dependents when it settles', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    let data: string | undefined;
    const fn = vi.fn(() => {
      if (data === undefined) {
        throw promise;
      }
      return data;
    });
    const d = createDerived(fn);
    let seen = '';

    createEffect(() => {
      try {
        seen = d.value;
      } catch (e) {
        seen = e === promise ? 'pending' : 'error';
      }
    });

    expect(seen).toBe('pending');

    data = 'ready';
    resolve();
    await promise;

    expect(seen).toBe('ready');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  describe('a thrown promise', () => {
    function setup() {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      let ready = false;
      const fn = vi.fn(() => {
        if (!ready) {
          throw promise;
        }
        return 'ready';
      });
      const d = createDerived(fn);

      return {
        d,
        fn,
        promise,
        settle: async () => {
          ready = true;
          resolve();
          await promise;
        },
      };
    }

    test('a disposed derived ignores a late settle', async () => {
      const { d, fn, settle } = setup();
      const effectSpy = vi.fn(() => {
        try {
          d.value;
        } catch {
          // Pending
        }
      });
      const stop = createEffect(effectSpy);

      d.dispose();
      stop();
      await settle();

      expect(fn).toHaveBeenCalledOnce();
      expect(effectSpy).toHaveBeenCalledOnce();
    });

    test('settling inside a batch does not run effects until the batch ends', () => {
      // A thenable we settle by hand, so the settle can happen while a batch is open
      const settle: Array<() => void> = [];
      const thenable = Promise.resolve();
      vi.spyOn(thenable, 'then').mockImplementation(((onFulfilled: () => void) => {
        settle.push(onFulfilled);
      }) as never);
      let ready = false;
      const d = createDerived(() => {
        if (!ready) {
          throw thenable;
        }
        return 'ready';
      });
      const seen: Array<string> = [];

      createEffect(() => {
        try {
          seen.push(d.value);
        } catch {
          seen.push('pending');
        }
      });

      expect(seen).toEqual(['pending']);

      batch(() => {
        ready = true;
        settle.forEach((callback) => callback());
        expect(seen).toEqual(['pending']);
      });

      expect(seen).toEqual(['pending', 'ready']);
    });
  });
});
