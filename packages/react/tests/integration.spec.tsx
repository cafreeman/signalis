import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, test, expect, afterEach } from 'vitest';
import {
  batch,
  createSignal,
  useSignal,
  useDerived,
  useSignalEffect,
  reactor,
} from '../src/index.js';

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

  test('a deps change that disposes a derived leaves no render waiting for an unrelated write', async () => {
    const unrelated = createSignal(0);
    let renders = 0;

    function DepsComponent() {
      renders++;
      const [dep, setDep] = React.useState(1);
      const scaled = useDerived(() => dep * 10, [dep]);

      return (
        <div>
          <div data-testid="scaled">{scaled.value}</div>
          <button data-testid="inc" onClick={() => setDep((x) => x + 1)} />
        </div>
      );
    }

    const WrappedDepsComponent = reactor(DepsComponent);
    render(<WrappedDepsComponent />);

    fireEvent.click(screen.getByTestId('inc'));

    await waitFor(() => {
      expect(screen.getByTestId('scaled').textContent).toBe('20');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const rendersBeforeWrite = renders;

    act(() => {
      unrelated.value = 1;
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(renders - rendersBeforeWrite).toBe(0);
  });

  test('an effect on a useDerived value does not fire when the component unmounts', async () => {
    const source = createSignal(1);
    const calls: Array<number> = [];

    function UnmountComponent() {
      const doubled = useDerived(() => source.value * 2);
      useSignalEffect(() => {
        calls.push(doubled.value);
      }, [doubled]);

      return <div data-testid="doubled">{doubled.value}</div>;
    }

    const WrappedUnmountComponent = reactor(UnmountComponent);
    const view = render(<WrappedUnmountComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('doubled').textContent).toBe('2');
    });
    expect(calls).toEqual([2]);

    view.unmount();
    act(() => {
      source.value = 5;
    });

    expect(calls).toEqual([2]);
  });

  test('an effect on a useDerived value runs once per value when its deps change', async () => {
    const calls: Array<number> = [];

    function DepsEffectComponent() {
      const [dep, setDep] = React.useState(1);
      const scaled = useDerived(() => dep * 10, [dep]);
      useSignalEffect(() => {
        calls.push(scaled.value);
      }, [scaled]);

      return (
        <div>
          <div data-testid="scaled">{scaled.value}</div>
          <button data-testid="inc" onClick={() => setDep((x) => x + 1)} />
        </div>
      );
    }

    const WrappedDepsEffectComponent = reactor(DepsEffectComponent);
    render(<WrappedDepsEffectComponent />);

    fireEvent.click(screen.getByTestId('inc'));

    await waitFor(() => {
      expect(screen.getByTestId('scaled').textContent).toBe('20');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(calls).toEqual([10, 20]);
  });

  describe('batch', () => {
    test('a reactor component renders once for a batch that writes several signals it reads', async () => {
      const x = createSignal(0);
      const y = createSignal(0);
      let renders = 0;

      function BatchComponent() {
        renders++;
        return (
          <div data-testid="sum">
            {x.value},{y.value}
          </div>
        );
      }

      const WrappedBatchComponent = reactor(BatchComponent);
      render(<WrappedBatchComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('sum').textContent).toBe('0,0');
      });
      const rendersBeforeBatch = renders;

      act(() => {
        batch(() => {
          x.value = 1;
          y.value = 2;
          x.value = 3;
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('sum').textContent).toBe('3,2');
      });
      expect(renders - rendersBeforeBatch).toBe(1);
    });

    test('a derived two levels below a signal reflects the write when read inside the batch', async () => {
      let readInBatch: number | undefined;

      function ChainComponent() {
        const count = useSignal(1);
        const doubled = useDerived(() => count.value * 2);
        const plusOne = useDerived(() => doubled.value + 1);

        return (
          <div>
            <div data-testid="plus-one">{plusOne.value}</div>
            <button
              data-testid="write"
              onClick={() => {
                batch(() => {
                  count.value = 5;
                  readInBatch = plusOne.value;
                });
              }}
            >
              write
            </button>
          </div>
        );
      }

      const WrappedChainComponent = reactor(ChainComponent);
      render(<WrappedChainComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('plus-one').textContent).toBe('3');
      });

      fireEvent.click(screen.getByTestId('write'));

      await waitFor(() => {
        expect(screen.getByTestId('plus-one').textContent).toBe('11');
      });
      expect(readInBatch).toBe(11);
    });
  });
});
