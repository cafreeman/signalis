import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import { createSignal, reactor } from '../src/index.js';

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
});
