import React, { Component, Suspense, type ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  Reaction,
  createDerived,
  createSignal,
  reactor,
  setErrorHandler,
  useDerived,
  useSignalEffect,
} from '../src/index.js';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <div data-testid="fallback">caught: {String(this.state.error)}</div>;
    }
    return this.props.children;
  }
}

describe('errors', () => {
  beforeEach(() => {
    // React logs every error it catches; the tests below throw on purpose
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('useSignalEffect', () => {
    test('an error on the effect’s first run reaches the nearest error boundary', () => {
      function Throws() {
        useSignalEffect(() => {
          throw new Error('first run');
        });
        return <div>fine</div>;
      }

      render(
        <ErrorBoundary>
          <Throws />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fallback').textContent).toContain('first run');
    });

    describe('on a later run', () => {
      let restore: () => void;
      let errors: Array<unknown>;

      beforeEach(() => {
        errors = [];
        restore = setErrorHandler((error) => {
          errors.push(error);
        });
      });

      afterEach(() => {
        restore();
      });

      test('the error goes to the handler, the write does not throw, and the effect runs again', () => {
        const source = createSignal(0);
        const error = new Error('later run');
        let runs = 0;

        function Effectful() {
          useSignalEffect(() => {
            runs++;
            if (source.value === 1) {
              throw error;
            }
          });
          return <div>fine</div>;
        }

        render(<Effectful />);
        expect(runs).toBe(1);

        expect(() => {
          source.value = 1;
        }).not.toThrow();
        expect(runs).toBe(2);
        expect(errors).toEqual([error]);

        source.value = 2;
        expect(runs).toBe(3);
        expect(errors).toEqual([error]);
      });
    });
  });

  describe('a derived that throws in an abandoned render', () => {
    test('leaves no observers behind when an error boundary catches it', () => {
      const source = createSignal(0);

      function Throws() {
        const derived = useDerived(() => {
          source.value;
          throw new Error('derived');
        });
        return <div>{derived.value}</div>;
      }

      render(
        <ErrorBoundary>
          <Throws />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fallback').textContent).toContain('derived');
      expect(source._observers ?? []).toHaveLength(0);
    });

    test('leaves no observers behind when Suspense abandons it', () => {
      const source = createSignal(0);
      const never = new Promise<never>(() => {});

      function Suspends() {
        const derived = useDerived(() => {
          source.value;
          throw never;
        });
        return <div>{derived.value}</div>;
      }

      render(
        <Suspense fallback={<div>loading</div>}>
          <Suspends />
        </Suspense>,
      );

      expect(screen.getByText('loading')).toBeTruthy();
      expect(source._observers ?? []).toHaveLength(0);
    });
  });

  describe('a module-level derived that threw', () => {
    test('is not retried by an error boundary reset until a source changes', () => {
      const source = createSignal(0);
      let fail = true;
      const derived = createDerived(() => {
        source.value;
        if (fail) {
          throw new Error('cached');
        }
        return 'recovered';
      });
      const Reader = reactor(() => <div data-testid="value">{derived.value}</div>);
      const boundary = React.createRef<ErrorBoundary>();

      render(
        <ErrorBoundary ref={boundary}>
          <Reader />
        </ErrorBoundary>,
      );
      expect(screen.getByTestId('fallback').textContent).toContain('cached');

      // The derived would succeed now, but nothing it read has changed, so it keeps its error
      fail = false;
      act(() => {
        boundary.current!.reset();
      });
      expect(screen.getByTestId('fallback').textContent).toContain('cached');

      source.value = 1;
      act(() => {
        boundary.current!.reset();
      });
      expect(screen.getByTestId('value').textContent).toBe('recovered');
    });

    test('that throws only on its first compute reaches the error boundary', () => {
      const source = createSignal(0);
      let computes = 0;
      const derived = createDerived(() => {
        source.value;
        computes++;
        if (computes === 1) {
          throw new Error('first compute');
        }
        return 'ok';
      });
      const Reader = reactor(() => <div data-testid="value">{derived.value}</div>);
      const recoverable: Array<unknown> = [];

      render(
        <ErrorBoundary>
          <Reader />
        </ErrorBoundary>,
        {
          onRecoverableError: (error) => {
            recoverable.push(error);
          },
        },
      );

      // React’s own recovery re-render re-reads the derived, and it rethrows the cached error
      // instead of recomputing, so the boundary shows the error and React has nothing to recover
      expect(screen.getByTestId('fallback').textContent).toContain('first compute');
      expect(computes).toBe(1);
      expect(recoverable).toHaveLength(0);
    });
  });

  test('a reactor reaction whose dispose throws on cleanup is not reused by the next setup', () => {
    const source = createSignal(0);
    const Reader = reactor(() => <div data-testid="value">{source.value}</div>);
    const dispose = Reaction.prototype.dispose;
    const disposed: Array<Reaction> = [];
    let throwOnce = true;

    // Dispose the reaction for real, then throw, as a cleanup function that throws would
    vi.spyOn(Reaction.prototype, 'dispose').mockImplementation(function (this: Reaction) {
      dispose.call(this);
      disposed.push(this);
      if (throwOnce) {
        throwOnce = false;
        throw new Error('cleanup');
      }
    });
    // Strict Mode runs the unmount cleanup and setup again on mount
    render(
      <React.StrictMode>
        <ErrorBoundary>
          <Reader />
        </ErrorBoundary>
      </React.StrictMode>,
    );

    // The cleanup error reaches the boundary, which unmounts the component. The setup that followed the failed cleanup must have made a fresh reaction, so the unmount disposes a different one
    expect(new Set(disposed).size).toBe(2);
  });

  test('a derived that throws a promise inside Suspense resumes when the promise resolves', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    let data: string | undefined;
    const derived = createDerived(() => {
      if (data === undefined) {
        throw promise;
      }
      return data;
    });
    const Reader = reactor(() => <div data-testid="value">{derived.value}</div>);

    render(
      <Suspense fallback={<div>loading</div>}>
        <Reader />
      </Suspense>,
    );

    expect(screen.getByText('loading')).toBeTruthy();

    data = 'ready';
    await act(async () => {
      resolve();
      await promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('ready');
    });
  });
});
