import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import { useSignal, useSignalEffect, reactor } from '../src/index.js';

// Test component for useSignalEffect
function TestUseSignalEffect({ initialValue = 0 }: { initialValue?: number }) {
  const signal = useSignal(initialValue);
  const effectCount = useSignal(0);

  useSignalEffect(() => {
    // Access the signal value to create a dependency
    const currentValue = signal.value;
    effectCount.value = effectCount.value + 1;
    return () => {
      // Cleanup function
    };
  });

  return (
    <div>
      <div data-testid="signal-value">{signal.value}</div>
      <div data-testid="effect-count">{effectCount.value}</div>
      <button data-testid="update-signal" onClick={() => (signal.value = signal.value + 1)}>
        Update Signal
      </button>
    </div>
  );
}

// Wrapped component for reactor testing
const WrappedTestUseSignalEffect = reactor(TestUseSignalEffect);

describe('useSignalEffect', () => {
  afterEach(() => {
    cleanup();
  });

  test('runs effect when component mounts', () => {
    render(<WrappedTestUseSignalEffect initialValue={0} />);

    expect(screen.getByTestId('effect-count').textContent).toBe('1');
  });

  test('runs effect when signal changes', async () => {
    render(<WrappedTestUseSignalEffect initialValue={0} />);

    const initialCount = parseInt(screen.getByTestId('effect-count').textContent || '0');

    fireEvent.click(screen.getByTestId('update-signal'));

    await waitFor(() => {
      const newCount = parseInt(screen.getByTestId('effect-count').textContent || '0');
      expect(newCount).toBe(initialCount + 1);
    });
  });

  test('runs effect multiple times when signal changes multiple times', async () => {
    render(<WrappedTestUseSignalEffect initialValue={0} />);

    const initialCount = parseInt(screen.getByTestId('effect-count').textContent || '0');

    // Update signal multiple times
    fireEvent.click(screen.getByTestId('update-signal'));
    fireEvent.click(screen.getByTestId('update-signal'));
    fireEvent.click(screen.getByTestId('update-signal'));

    await waitFor(() => {
      const newCount = parseInt(screen.getByTestId('effect-count').textContent || '0');
      expect(newCount).toBe(initialCount + 3);
    });
  });

  test('maintains effect across re-renders', () => {
    const { rerender } = render(<WrappedTestUseSignalEffect initialValue={0} />);

    const initialCount = parseInt(screen.getByTestId('effect-count').textContent || '0');

    // Re-render
    rerender(<WrappedTestUseSignalEffect initialValue={0} />);

    // Effect count should remain the same (effect doesn't re-run on re-render)
    expect(screen.getByTestId('effect-count').textContent).toBe(initialCount.toString());
  });
});
