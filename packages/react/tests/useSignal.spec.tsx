import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach, expectTypeOf } from 'vitest';
import { useSignal, reactor } from '../src/index.js';
import type { Signal } from '@signalis/core';

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

  test('expensive computation without lazy init runs on every render', () => {
    let computeCount = 0;
    const expensiveComputation = () => {
      computeCount++;
      return 100;
    };

    function Component({ trigger }: { trigger: number }) {
      const signal = useSignal(expensiveComputation());
      return <div data-testid="value">{signal.value}</div>;
    }

    const Wrapped = reactor(Component);
    const { rerender } = render(<Wrapped trigger={1} />);

    const initialCount = computeCount;
    expect(initialCount).toBeGreaterThanOrEqual(1);

    rerender(<Wrapped trigger={2} />);
    expect(computeCount).toBeGreaterThan(initialCount);
  });

  test('lazy initializer function only called once', () => {
    let computeCount = 0;

    function Component({ trigger }: { trigger: number }) {
      const signal = useSignal(() => {
        computeCount++;
        return 100;
      });
      return <div data-testid="value">{signal.value}</div>;
    }

    const Wrapped = reactor(Component);
    const { rerender } = render(<Wrapped trigger={1} />);

    expect(computeCount).toBe(1);

    rerender(<Wrapped trigger={2} />);
    expect(computeCount).toBe(1);
  });

  test('maintains backward compatibility with direct values', () => {
    function Component() {
      const signal = useSignal(42);
      return <div data-testid="value">{signal.value}</div>;
    }

    const Wrapped = reactor(Component);
    render(<Wrapped />);

    expect(screen.getByTestId('value').textContent).toBe('42');
  });

  test('typescript type inference for useSignal', () => {
    function TypeTestComponent() {
      const direct = useSignal(42);
      expectTypeOf(direct).toEqualTypeOf<Signal<number>>();

      const lazy = useSignal(() => 42);
      expectTypeOf(lazy).toEqualTypeOf<Signal<number>>();

      const noArg = useSignal();
      expectTypeOf(noArg).toEqualTypeOf<Signal<unknown>>();

      return <div>Types validated</div>;
    }

    const Wrapped = reactor(TypeTestComponent);
    render(<Wrapped />);
    expect(screen.getByText('Types validated')).toBeDefined();
  });

  test('type assertions for all useSignal modes', () => {
    function TypeTestComponent() {
      // Test all possible useSignal modes
      
      // 1. No arguments - should return Signal<unknown>
      const noArgs = useSignal();
      expectTypeOf(noArgs).toEqualTypeOf<Signal<unknown>>();

      // 2. null - should return Signal<unknown>
      const nullValue = useSignal(null);
      expectTypeOf(nullValue).toEqualTypeOf<Signal<unknown>>();

      // 3. Some value - should return Signal<value type>
      const stringValue = useSignal('hello');
      expectTypeOf(stringValue).toEqualTypeOf<Signal<string>>();

      const numberValue = useSignal(42);
      expectTypeOf(numberValue).toEqualTypeOf<Signal<number>>();

      const objectValue = useSignal({ name: 'John', age: 30 });
      expectTypeOf(objectValue).toEqualTypeOf<Signal<{ name: string; age: number }>>();

      // 4. Lazy initializer - should return Signal<return type>
      const lazyString = useSignal(() => 'lazy string');
      expectTypeOf(lazyString).toEqualTypeOf<Signal<string>>();

      const lazyObject = useSignal(() => ({ computed: true }));
      expectTypeOf(lazyObject).toEqualTypeOf<Signal<{ computed: boolean }>>();

      return <div>All type modes validated</div>;
    }

    const Wrapped = reactor(TypeTestComponent);
    render(<Wrapped />);
    expect(screen.getByText('All type modes validated')).toBeDefined();
  });
});
