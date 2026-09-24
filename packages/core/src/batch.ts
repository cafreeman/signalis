import { batchStart, batchEnd } from './state.js';

export function batch(cb: () => void): void {
  batchStart();
  try {
    cb();
  } finally {
    // We flush in a `finally` so that an exception thrown from `cb` can never
    // leave the system stuck inside a never-ending batch, which would
    // silently buffer all subsequent updates forever
    batchEnd();
  }
}
