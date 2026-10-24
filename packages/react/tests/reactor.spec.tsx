import React, { Suspense, useLayoutEffect } from 'react';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import { createDerived, createSignal, reactor } from '../src/index.js';

// Test component for reactor
function TestReactorComponent({ initialValue = 0 }: { initialValue?: number }) {
  const signal = createSignal(initialValue);

  return (
    <div>
      <div data-testid="signal-value">{signal.value}</div>
      <button data-testid="update-signal" onClick={() => (signal.value = signal.value + 1)}>
        Update Signal
      </button>
    </div>
  );
}

describe('reactor', () => {
  afterEach(() => {
    cleanup();
  });

  test('returns same proxy for same component', () => {
    const Component1 = reactor(TestReactorComponent);
    const Component2 = reactor(TestReactorComponent);

    // Should return the same proxy instance for the same component
    expect(Component1).toBe(Component2);
  });

  test('maintains hook state across multiple reactor calls', () => {
    // Create a shared signal outside the component
    const sharedSignal = createSignal(0);

    function TestComponentWithSharedSignal() {
      return (
        <div>
          <div data-testid="signal-value">{sharedSignal.value}</div>
          <button
            data-testid="update-signal"
            onClick={() => (sharedSignal.value = sharedSignal.value + 1)}
          >
            Update Signal
          </button>
        </div>
      );
    }

    // Create two wrapped components from the same base component
    const Wrapped1 = reactor(TestComponentWithSharedSignal);
    const Wrapped2 = reactor(TestComponentWithSharedSignal);

    // They should be the same proxy
    expect(Wrapped1).toBe(Wrapped2);

    // Render the first one and update its state
    const { rerender } = render(<Wrapped1 />);
    expect(screen.getByTestId('signal-value').textContent).toBe('0');

    // Update the signal
    fireEvent.click(screen.getByTestId('update-signal'));
    expect(screen.getByTestId('signal-value').textContent).toBe('1');

    // Re-render with the second wrapped component (same proxy)
    rerender(<Wrapped2 />);

    // Should maintain the updated state, not reset to initial
    expect(screen.getByTestId('signal-value').textContent).toBe('1');
  });

  test('different components get different proxies', () => {
    function AnotherComponent() {
      return <div>Another</div>;
    }

    const Wrapped1 = reactor(TestReactorComponent);
    const Wrapped2 = reactor(AnotherComponent);

    // Different components should get different proxies
    expect(Wrapped1).not.toBe(Wrapped2);
  });

  test('multiple calls to reactor with same component are idempotent', () => {
    const Wrapped1 = reactor(TestReactorComponent);
    const Wrapped2 = reactor(TestReactorComponent);
    const Wrapped3 = reactor(TestReactorComponent);

    // All should be the same proxy
    expect(Wrapped1).toBe(Wrapped2);
    expect(Wrapped2).toBe(Wrapped3);
    expect(Wrapped1).toBe(Wrapped3);
  });

  test('does not subscribe a reactor from a render that suspends before commit', () => {
    const signal = createSignal(0);
    const never = new Promise<never>(() => {});

    const Wrapped = reactor(() => {
      signal.value;
      return <div>tracked</div>;
    });

    function Suspends() {
      throw never;
    }

    function Parent() {
      return (
        <>
          <Wrapped />
          <Suspends />
        </>
      );
    }

    render(
      <Suspense fallback={<div>loading</div>}>
        <Parent />
      </Suspense>,
    );

    expect(signal._observers ?? []).toHaveLength(0);
  });

  test('catches signal changes made by ancestor layout effects on mount', () => {
    const signal = createSignal(0);
    const Wrapped = reactor(() => <div data-testid="value">{signal.value}</div>);

    function Parent() {
      useLayoutEffect(() => {
        signal.value = 1;
      }, []);

      return <Wrapped />;
    }

    render(<Parent />);

    expect(screen.getByTestId('value').textContent).toBe('1');
  });

  test('catches changes to a derived it starts reading on a re-render, made before that render commits', () => {
    const show = createSignal(false);
    const count = createSignal(0);
    const doubled = createDerived(() => count.value * 2);
    const Wrapped = reactor(() => {
      const visible = show.value;

      // Runs after a render that reads `doubled` for the first time, but before the passive
      // effect that commits that read as a subscription
      useLayoutEffect(() => {
        if (visible && count.value === 0) {
          count.value = 1;
        }
      });

      return <div data-testid="value">{visible ? doubled.value : 'hidden'}</div>;
    });

    render(<Wrapped />);
    expect(screen.getByTestId('value').textContent).toBe('hidden');

    act(() => {
      show.value = true;
    });

    expect(screen.getByTestId('value').textContent).toBe('2');
  });

  // A component that writes, during its own render, a signal it read in that render. These pin the
  // current behavior so that changes to how reactor catches writes between render and commit keep it
  describe('writes a signal it reads, during its own render', () => {
    function createWriter(write: (signal: { value: number }) => void) {
      const signal = createSignal(0);
      const counts = { renders: 0 };
      const Wrapped = reactor(() => {
        counts.renders++;
        const value = signal.value;
        write(signal);
        return <div data-testid="value">{value}</div>;
      });

      return { signal, counts, Wrapped };
    }

    test('on mount, re-renders to show a write that settles', () => {
      const { signal, counts, Wrapped } = createWriter((target) => {
        if (target.value < 1) {
          target.value = 1;
        }
      });

      render(<Wrapped />);

      expect(signal.value).toBe(1);
      expect(screen.getByTestId('value').textContent).toBe('1');
      expect(counts.renders).toBe(2);
    });

    test('on mount, a write of the value it already has changes nothing', () => {
      const { signal, Wrapped } = createWriter((target) => {
        const current = target.value;
        target.value = current;
      });

      render(<Wrapped />);

      expect(signal.value).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('0');
    });

    test('on mount, a write that never settles fails loudly instead of hanging', () => {
      const { Wrapped } = createWriter((target) => {
        target.value = target.value + 1;
      });

      expect(() => render(<Wrapped />)).toThrow(/Too many re-renders/);
    });

    test('on a re-render, re-renders to show a write that settles', () => {
      let armed = false;
      const { signal, counts, Wrapped } = createWriter((target) => {
        if (armed && target.value < 5) {
          target.value = 5;
        }
      });

      render(<Wrapped />);
      const rendersAfterMount = counts.renders;

      act(() => {
        armed = true;
        signal.value = 1;
      });

      expect(signal.value).toBe(5);
      expect(screen.getByTestId('value').textContent).toBe('5');
      expect(counts.renders - rendersAfterMount).toBe(2);
    });

    test('on a re-render, a write that never settles fails loudly instead of hanging', () => {
      let armed = false;
      const { signal, Wrapped } = createWriter((target) => {
        if (armed) {
          target.value = target.value + 1;
        }
      });

      render(<Wrapped />);

      expect(() =>
        act(() => {
          armed = true;
          signal.value = 1;
        }),
      ).toThrow(/Too many re-renders/);
    });
  });
});
