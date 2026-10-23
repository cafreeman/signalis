/**
 * Which construct an error came from: `createEffect`, `when`, or a bare `Reaction`.
 */
export type ErrorSource = 'effect' | 'when' | 'reaction';

export interface ErrorInfo {
  source: ErrorSource;
}

export type ErrorHandler = (error: unknown, info: ErrorInfo) => void;

let currentHandler: ErrorHandler | null = null;

/**
 * Install the handler that receives errors thrown by effects that re-run because a source changed.
 * Those effects have no caller to throw to, so the error goes here instead of out of the write that
 * triggered them. Passing `null` removes the handler. Returns a function that restores the handler
 * that was installed before this call.
 */
export function setErrorHandler(handler: ErrorHandler | null): () => void {
  const previous = currentHandler;
  currentHandler = handler;

  return () => {
    currentHandler = previous;
  };
}

// Throw `error` on a later task, so it surfaces as an uncaught error instead of unwinding the
// reactive graph (which must finish running the effects that are still queued)
function rethrowLater(error: unknown): void {
  // Looked up on every call rather than at load, because not every environment has it (Node and
  // jsdom don't) and a test may stub it
  const report = (globalThis as { reportError?: (error: unknown) => void }).reportError;

  if (typeof report === 'function') {
    report(error);
  } else {
    queueMicrotask(() => {
      throw error;
    });
  }
}

/**
 * @internal
 */
export function reportEffectError(error: unknown, source: ErrorSource): void {
  if (currentHandler === null) {
    rethrowLater(error);
    return;
  }

  try {
    currentHandler(error, { source });
  } catch (handlerError) {
    rethrowLater(handlerError);
  }
}
