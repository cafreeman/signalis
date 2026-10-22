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
});
