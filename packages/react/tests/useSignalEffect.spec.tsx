import React, { useState } from 'react';
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

    rerender(<WrappedTestUseSignalEffect initialValue={0} />);

    expect(screen.getByTestId('effect-count').textContent).toBe(initialCount.toString());
  });

  test('handles mixed dependencies with signals and props', async () => {
    function MixedDepsComponent({ userId }: { userId: string }) {
      const refreshCount = useSignal(0);
      const effectLog = useSignal<string[]>([]);

      useSignalEffect(() => {
        const logEntry = `User: ${userId}, Refresh: ${refreshCount.value}`;
        effectLog.value = [...effectLog.value, logEntry];
      }, [userId]);

      return (
        <div>
          <div data-testid="effect-log">{effectLog.value.join(' | ')}</div>
          <button
            data-testid="refresh"
            onClick={() => (refreshCount.value = refreshCount.value + 1)}
          >
            Refresh
          </button>
        </div>
      );
    }

    const WrappedComponent = reactor(MixedDepsComponent);
    const { rerender } = render(<WrappedComponent userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('effect-log').textContent).toBe('User: user-1, Refresh: 0');
    });

    fireEvent.click(screen.getByTestId('refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('effect-log').textContent).toBe(
        'User: user-1, Refresh: 0 | User: user-1, Refresh: 1',
      );
    });

    rerender(<WrappedComponent userId="user-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('effect-log').textContent).toBe(
        'User: user-1, Refresh: 0 | User: user-1, Refresh: 1 | User: user-2, Refresh: 1',
      );
    });
  });

  test('does not double-fire with mixed dependencies', async () => {
    const effectRunLog: string[] = [];

    function TestComponent({ userId }: { userId: string }) {
      const count = useSignal(0);

      useSignalEffect(() => {
        const logEntry = `User: ${userId}, Count: ${count.value}`;
        effectRunLog.push(logEntry);
      }, [userId]);

      return (
        <div>
          <div data-testid="log-count">{effectRunLog.length}</div>
          <div data-testid="latest-log">{effectRunLog[effectRunLog.length - 1]}</div>
          <button data-testid="increment" onClick={() => (count.value = count.value + 1)}>
            Increment
          </button>
        </div>
      );
    }

    const WrappedComponent = reactor(TestComponent);
    const { rerender } = render(<WrappedComponent userId="user-1" />);

    // Effect should run once on mount
    await waitFor(() => {
      expect(effectRunLog.length).toBe(1);
      expect(effectRunLog[0]).toBe('User: user-1, Count: 0');
    });

    // Signal changes - effect should run once via signal reactivity
    fireEvent.click(screen.getByTestId('increment'));

    await waitFor(() => {
      expect(effectRunLog.length).toBe(2);
      expect(effectRunLog[1]).toBe('User: user-1, Count: 1');
    });

    // Prop changes - effect should recreate and run once
    rerender(<WrappedComponent userId="user-2" />);

    await waitFor(() => {
      // Should be 3 total runs: mount + signal change + prop change
      expect(effectRunLog.length).toBe(3);
      expect(effectRunLog[2]).toBe('User: user-2, Count: 1');
    });

    // This should only fire once (via signal reactivity)
    fireEvent.click(screen.getByTestId('increment'));

    await waitFor(() => {
      expect(effectRunLog.length).toBe(4);
      expect(effectRunLog[3]).toBe('User: user-2, Count: 2');
    });
  });

  test('handles mixed dependencies with useState', async () => {
    const effectRunLog: string[] = [];

    function TestComponent() {
      const [userId, setUserId] = useState('user-1');
      const count = useSignal(0);

      useSignalEffect(() => {
        const logEntry = `User: ${userId}, Count: ${count.value}`;
        effectRunLog.push(logEntry);
      }, [userId]);

      return (
        <div>
          <div data-testid="log-count">{effectRunLog.length}</div>
          <div data-testid="latest-log">{effectRunLog[effectRunLog.length - 1]}</div>
          <button data-testid="change-user" onClick={() => setUserId('user-2')}>
            Change User
          </button>
          <button data-testid="increment" onClick={() => (count.value = count.value + 1)}>
            Increment
          </button>
        </div>
      );
    }

    const WrappedComponent = reactor(TestComponent);
    render(<WrappedComponent />);

    await waitFor(() => {
      expect(effectRunLog.length).toBe(1);
      expect(effectRunLog[0]).toBe('User: user-1, Count: 0');
    });

    fireEvent.click(screen.getByTestId('increment'));

    await waitFor(() => {
      expect(effectRunLog.length).toBe(2);
      expect(effectRunLog[1]).toBe('User: user-1, Count: 1');
    });

    fireEvent.click(screen.getByTestId('change-user'));

    await waitFor(() => {
      expect(effectRunLog.length).toBe(3);
      expect(effectRunLog[2]).toBe('User: user-2, Count: 1');
    });

    fireEvent.click(screen.getByTestId('increment'));

    await waitFor(() => {
      expect(effectRunLog.length).toBe(4);
      expect(effectRunLog[3]).toBe('User: user-2, Count: 2');
    });
  });
});
