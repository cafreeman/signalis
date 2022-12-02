import { batchEnd, batchStart } from './state.js';

export function batch(cb: () => void) {
  batchStart();

  cb();

  batchEnd();
}
