import React, { useState } from 'react';
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

  test('handles mixed dependencies with signals and props', async () => {
    function MixedDepsComponent({ multiplier }: { multiplier: number }) {
      const price = useSignal(100);
      const total = useDerived(() => price.value * multiplier, [multiplier]);

      return (
        <div>
          <div data-testid="total">{total.value}</div>
          <button data-testid="update-price" onClick={() => (price.value += 10)}>
            Update Price
          </button>
        </div>
      );
    }

    const Wrapped = reactor(MixedDepsComponent);
    const { rerender } = render(<Wrapped multiplier={2} />);

    // Initial: 100 * 2 = 200
    expect(screen.getByTestId('total').textContent).toBe('200');

    // Signal change: 110 * 2 = 220
    fireEvent.click(screen.getByTestId('update-price'));
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('220');
    });

    // Prop change: 110 * 3 = 330
    rerender(<Wrapped multiplier={3} />);
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('330');
    });

    // Signal change again: 120 * 3 = 360
    fireEvent.click(screen.getByTestId('update-price'));
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('360');
    });
  });

  test('does not double-compute with mixed dependencies', async () => {
    const computeLog: string[] = [];

    function TestComponent({ multiplier }: { multiplier: number }) {
      const count = useSignal(0);
      const derived = useDerived(() => {
        const result = count.value * multiplier;
        computeLog.push(`Computed: ${count.value} * ${multiplier} = ${result}`);
        return result;
      }, [multiplier]);

      return (
        <div>
          <div data-testid="value">{derived.value}</div>
          <div data-testid="log-count">{computeLog.length}</div>
          <button data-testid="increment" onClick={() => (count.value += 1)}>
            Increment
          </button>
        </div>
      );
    }

    const Wrapped = reactor(TestComponent);
    const { rerender } = render(<Wrapped multiplier={2} />);

    // Should compute once on mount (when .value is accessed)
    await waitFor(() => {
      expect(computeLog.length).toBe(1);
      expect(computeLog[0]).toBe('Computed: 0 * 2 = 0');
    });

    // Signal changes - should compute once
    fireEvent.click(screen.getByTestId('increment'));
    await waitFor(() => {
      expect(computeLog.length).toBe(2);
      expect(computeLog[1]).toBe('Computed: 1 * 2 = 2');
    });

    // Prop changes - should recreate derived and compute once
    rerender(<Wrapped multiplier={3} />);
    await waitFor(() => {
      expect(computeLog.length).toBe(3);
      expect(computeLog[2]).toBe('Computed: 1 * 3 = 3');
    });
  });

  test('handles mixed dependencies with useState', async () => {
    function TestComponent() {
      const [taxRate, setTaxRate] = useState(0.1);
      const price = useSignal(100);
      const total = useDerived(() => Math.round(price.value * (1 + taxRate)), [taxRate]);

      return (
        <div>
          <div data-testid="total">{total.value}</div>
          <button data-testid="change-tax" onClick={() => setTaxRate(0.2)}>
            Change Tax
          </button>
          <button data-testid="update-price" onClick={() => (price.value += 10)}>
            Update Price
          </button>
        </div>
      );
    }

    const Wrapped = reactor(TestComponent);
    render(<Wrapped />);

    // Initial: 100 * 1.1 = 110
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('110');
    });

    // State change: 100 * 1.2 = 120
    fireEvent.click(screen.getByTestId('change-tax'));
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('120');
    });

    // Signal change: 110 * 1.2 = 132
    fireEvent.click(screen.getByTestId('update-price'));
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('132');
    });
  });

  test('works without deps for signal-only reactivity (backward compatible)', async () => {
    function TestComponent() {
      const count = useSignal(0);
      const doubled = useDerived(() => count.value * 2);

      return (
        <div>
          <div data-testid="doubled">{doubled.value}</div>
          <button data-testid="increment" onClick={() => (count.value += 1)}>
            Increment
          </button>
        </div>
      );
    }

    const Wrapped = reactor(TestComponent);
    render(<Wrapped />);

    expect(screen.getByTestId('doubled').textContent).toBe('0');

    fireEvent.click(screen.getByTestId('increment'));
    await waitFor(() => {
      expect(screen.getByTestId('doubled').textContent).toBe('2');
    });
  });
});
