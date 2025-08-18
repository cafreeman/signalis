import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import { useSignal, useDerived, reactor } from '../src/index.js';

// Test component for useDerived
function TestUseDerived({ baseValue = 0 }: { baseValue?: number }) {
  const baseSignal = useSignal(baseValue);
  const derived = useDerived(() => baseSignal.value * 2);

  return (
    <div>
      <div data-testid="base-value">{baseSignal.value}</div>
      <div data-testid="derived-value">{derived.value}</div>
      <button data-testid="update-base" onClick={() => (baseSignal.value = baseSignal.value + 1)}>
        Update Base
      </button>
    </div>
  );
}

// Wrapped component for reactor testing
const WrappedTestUseDerived = reactor(TestUseDerived);

describe('useDerived', () => {
  afterEach(() => {
    cleanup();
  });

  test('creates a derived signal that depends on base signal', () => {
    render(<WrappedTestUseDerived baseValue={3} />);

    expect(screen.getByTestId('base-value').textContent).toBe('3');
    expect(screen.getByTestId('derived-value').textContent).toBe('6');
  });

  test('updates derived value when base signal changes', async () => {
    render(<WrappedTestUseDerived baseValue={2} />);

    expect(screen.getByTestId('derived-value').textContent).toBe('4');

    fireEvent.click(screen.getByTestId('update-base'));

    await waitFor(() => {
      expect(screen.getByTestId('base-value').textContent).toBe('3');
      expect(screen.getByTestId('derived-value').textContent).toBe('6');
    });
  });

  test('maintains derived instance across re-renders', () => {
    const { rerender } = render(<WrappedTestUseDerived baseValue={1} />);

    // Update base signal
    fireEvent.click(screen.getByTestId('update-base'));
    expect(screen.getByTestId('derived-value').textContent).toBe('4');

    // Re-render
    rerender(<WrappedTestUseDerived baseValue={1} />);

    // Should maintain the derived value based on updated base
    expect(screen.getByTestId('derived-value').textContent).toBe('4');
  });

  test('maintains derived state across re-renders with different props', () => {
    const { rerender } = render(<WrappedTestUseDerived baseValue={1} />);

    // Update first component
    fireEvent.click(screen.getByTestId('update-base'));
    expect(screen.getByTestId('derived-value').textContent).toBe('4');

    // Re-render with different props - derived should maintain its state
    rerender(<WrappedTestUseDerived baseValue={5} />);
    expect(screen.getByTestId('derived-value').textContent).toBe('4');

    // Update derived again
    fireEvent.click(screen.getByTestId('update-base'));
    expect(screen.getByTestId('derived-value').textContent).toBe('6');
  });
});
