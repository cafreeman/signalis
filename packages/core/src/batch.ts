import { batchStart, batchEnd } from './state.js';

export function batch(cb: () => void): void {
  batchStart();
  try {
    cb();
  } finally {
    // We end the batch in a `finally` so that an exception thrown from `cb` can never
    // leave the system stuck inside a never-ending batch, which would hold back
    // the effects of every later write forever
    batchEnd();
  }
}
