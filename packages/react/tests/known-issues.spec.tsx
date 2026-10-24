import React, { useLayoutEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createSignal, reactor, useDerived } from '../src/index.js';

// Each test here asserts the behavior we intend, and fails today because of a known issue. They run
// as `test.fails`, so the suite stays green while the issue exists and turns red once it's fixed:
// at that point, move the test into the regular spec for that area as a plain `test`. Run with
// SHOW_KNOWN_ISSUES=1 to see the actual assertion failures.
const knownIssue = process.env['SHOW_KNOWN_ISSUES'] ? test : test.fails;

afterEach(() => {
  cleanup();
});

// Render-time reads are linked only after commit (deferred source collection). When the commit
// links a source that changed after it was read, `hasInvalidatedSource` is supposed to catch it,
// but it can only see deriveds that left CLEAN: `Signal#_isClean` is always true, so a signal
// written between render and commit goes unnoticed. These tests mirror the existing derived
// coverage in reactor.spec.tsx ("catches changes to a derived it starts reading on a re-render")
describe('known issues: writes between render and commit', () => {
  knownIssue(
    'a reactor component catches a write to a signal it starts reading on a re-render, made before that render commits',
    () => {
      const show = createSignal(false);
      const count = createSignal(0);
      const Wrapped = reactor(() => {
        const visible = show.value;

        // Runs after a render that reads `count` for the first time, but before the passive
        // effect that commits that read as a subscription
        useLayoutEffect(() => {
          if (visible && count.value === 0) {
            count.value = 1;
          }
        });

        return <div data-testid="value">{visible ? count.value : 'hidden'}</div>;
      });

      render(<Wrapped />);
      act(() => {
        show.value = true;
      });

      expect(count.value).toBe(1);
      expect(screen.getByTestId('value').textContent).toBe('1');
    },
  );

  // reactor.spec.tsx covers this case for a signal read directly in render. Through `useDerived`,
  // reactor's extra mount render doesn't help, because it re-reads the derived's stale cache
  knownIssue('useDerived catches signal changes made by ancestor layout effects on mount', () => {
    const s = createSignal(1);
    const Wrapped = reactor(() => {
      const doubled = useDerived(() => s.value * 2);
      return <div data-testid="value">{doubled.value}</div>;
    });

    function Parent() {
      useLayoutEffect(() => {
        s.value = 5;
      }, []);

      return <Wrapped />;
    }

    render(<Parent />);

    expect(screen.getByTestId('value').textContent).toBe('10');
  });

  knownIssue(
    'useDerived catches a write to a signal it starts reading on a re-render, made before that render commits',
    () => {
      const show = createSignal(false);
      const count = createSignal(0);
      const Wrapped = reactor(() => {
        const visible = show.value;
        const doubled = useDerived(() => (show.value ? count.value * 2 : -1));

        useLayoutEffect(() => {
          if (visible && count.value === 0) {
            count.value = 1;
          }
        });

        return <div data-testid="value">{doubled.value}</div>;
      });

      render(<Wrapped />);
      act(() => {
        show.value = true;
      });

      expect(count.value).toBe(1);
      expect(screen.getByTestId('value').textContent).toBe('2');
    },
  );
});

describe('known issues: render counts', () => {
  // reactor's mount effect calls `forceUpdate()` unconditionally to catch writes made between the
  // first render and the subscription (see the test above), so every reactor component renders
  // twice on mount even when nothing changed
  knownIssue('a reactor component renders once on mount when nothing changes', () => {
    const s = createSignal(0);
    let renders = 0;
    const Wrapped = reactor(() => {
      renders++;
      return <div>{s.value}</div>;
    });

    render(<Wrapped />);

    expect(renders).toBe(1);
  });
});
