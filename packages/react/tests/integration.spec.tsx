import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import { useSignal, useDerived, reactor } from '../src/index.js';

describe('Integration Tests', () => {
  afterEach(() => {
    cleanup();
  });

  test('useSignal and useDerived work together', async () => {
    function IntegrationComponent() {
      const count = useSignal(0);
      const doubled = useDerived(() => count.value * 2);
      const squared = useDerived(() => count.value * count.value);

      return (
        <div>
          <div data-testid="count">{count.value}</div>
          <div data-testid="doubled">{doubled.value}</div>
          <div data-testid="squared">{squared.value}</div>
          <button data-testid="increment" onClick={() => count.value++}>
            Increment
          </button>
        </div>
      );
    }

    const WrappedIntegrationComponent = reactor(IntegrationComponent);
    render(<WrappedIntegrationComponent />);

    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('doubled').textContent).toBe('0');
    expect(screen.getByTestId('squared').textContent).toBe('0');

    fireEvent.click(screen.getByTestId('increment'));

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
      expect(screen.getByTestId('doubled').textContent).toBe('2');
      expect(screen.getByTestId('squared').textContent).toBe('1');
    });
  });

  test('reactor with useSignal works correctly', async () => {
    function ReactorIntegrationComponent({ initialValue = 0 }: { initialValue?: number }) {
      const signal = useSignal(initialValue);

      return (
        <div>
          <div data-testid="signal-value">{signal.value}</div>
          <button data-testid="update" onClick={() => signal.value++}>
            Update
          </button>
        </div>
      );
    }

    const WrappedComponent = reactor(ReactorIntegrationComponent);
    render(<WrappedComponent initialValue={10} />);

    expect(screen.getByTestId('signal-value').textContent).toBe('10');

    fireEvent.click(screen.getByTestId('update'));

    await waitFor(() => {
      expect(screen.getByTestId('signal-value').textContent).toBe('11');
    });
  });
});
