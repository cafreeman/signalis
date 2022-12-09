import { batchStart, batchEnd } from './state.js';

export function batch(cb: () => void): void {
  batchStart();
  cb();
  batchEnd();
}
