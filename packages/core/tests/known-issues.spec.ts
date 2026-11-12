import { describe, expect, test } from 'vitest';
import { createDerived } from '../src/derived.js';
import { createSignal } from '../src/signal.js';

// Each test here asserts the behavior we intend, and fails today because of a known issue. They run
// as `test.fails`, so the suite stays green while the issue exists and turns red once it's fixed:
// at that point, move the test into the regular spec for that area as a plain `test`. Run with
// SHOW_KNOWN_ISSUES=1 to see the actual assertion failures.
const knownIssue = process.env['SHOW_KNOWN_ISSUES'] ? test : test.fails;

describe('known issues: dependency edges', () => {
  // `markDependency` doesn't deduplicate reads within one run, so each repeated read adds another
  // entry to both the computation's `_sources` and the source's `_observers`. Values and run counts
  // are unaffected; marking, validating and unlinking all walk the duplicates
  knownIssue('reading the same signal several times in one computation links it once', () => {
    const s = createSignal(1);
    const d = createDerived(() => s.value + s.value + s.value);

    expect(d.value).toBe(3);
    expect(d._sources).toHaveLength(1);
    expect(s._observers).toHaveLength(1);
  });

  // `spliceWhenKnown` finds the observer to remove with a linear scan of the source's `_observers`,
  // so dropping a dependency on a source with N observers costs O(N). This counts the element reads
  // the unlink makes, which is deterministic where timing isn't
  knownIssue('dropping a dependency does not scan the source’s whole observer list', () => {
    const shared = createSignal(0);
    const others = Array.from({ length: 1000 }, () => createDerived(() => shared.value));
    for (const other of others) {
      other.value;
    }

    const useShared = createSignal(true);
    const dynamic = createDerived(() => (useShared.value ? shared.value : 0));
    dynamic.value;

    let elementReads = 0;
    shared._observers = new Proxy(shared._observers!, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          elementReads++;
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    useShared.value = false;
    dynamic.value;

    expect(shared._observers).toHaveLength(1000);
    expect(elementReads).toBeLessThan(10);
  });
});
