import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import { useSignal, reactor } from '../src/index.js';

// Test component for useSignal
function TestUseSignal({ initialValue = 0 }: { initialValue?: number }) {
  const signal = useSignal(initialValue);

  return (
    <div>
      <div data-testid="signal-value">{signal.value}</div>
      <button data-testid="increment" onClick={() => (signal.value = signal.value + 1)}>
        Increment
      </button>
      <button data-testid="decrement" onClick={() => (signal.value = signal.value - 1)}>
        Decrement
      </button>
    </div>
  );
}

// Wrapped component for reactor testing
const WrappedTestUseSignal = reactor(TestUseSignal);

describe('useSignal', () => {
  afterEach(() => {
    cleanup();
  });

  test('creates a signal with initial value', () => {
    render(<WrappedTestUseSignal initialValue={42} />);
    expect(screen.getByTestId('signal-value').textContent).toBe('42');
  });

  test('creates a signal with default value when no initial value provided', () => {
    render(<WrappedTestUseSignal />);
    expect(screen.getByTestId('signal-value').textContent).toBe('0');
  });

  test('updates signal value when increment button is clicked', async () => {
    render(<WrappedTestUseSignal initialValue={5} />);

    expect(screen.getByTestId('signal-value').textContent).toBe('5');

    fireEvent.click(screen.getByTestId('increment'));

    await waitFor(() => {
      expect(screen.getByTestId('signal-value').textContent).toBe('6');
    });
  });

  test('updates signal value when decrement button is clicked', async () => {
    render(<WrappedTestUseSignal initialValue={10} />);

    expect(screen.getByTestId('signal-value').textContent).toBe('10');

    fireEvent.click(screen.getByTestId('decrement'));

    await waitFor(() => {
      expect(screen.getByTestId('signal-value').textContent).toBe('9');
    });
  });

  test('maintains signal instance across re-renders', () => {
    const { rerender } = render(<WrappedTestUseSignal initialValue={1} />);

    // Get initial value
    expect(screen.getByTestId('signal-value').textContent).toBe('1');

    // Update the signal
    fireEvent.click(screen.getByTestId('increment'));

    // Re-render with same props
    rerender(<WrappedTestUseSignal initialValue={1} />);

    // Should maintain the updated value, not reset to initial
    expect(screen.getByTestId('signal-value').textContent).toBe('2');
  });

  test('maintains signal state across re-renders with different props', () => {
    const { rerender } = render(<WrappedTestUseSignal initialValue={1} />);

    // Update first component's signal
    fireEvent.click(screen.getByTestId('increment'));
    expect(screen.getByTestId('signal-value').textContent).toBe('2');

    // Re-render with different props - signal should maintain its state
    rerender(<WrappedTestUseSignal initialValue={5} />);
    expect(screen.getByTestId('signal-value').textContent).toBe('2');

    // Update signal again
    fireEvent.click(screen.getByTestId('increment'));
    expect(screen.getByTestId('signal-value').textContent).toBe('3');
  });
});
