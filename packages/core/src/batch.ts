import { batchEnd, batchStart } from './state';

export function batch(cb: () => void) {
  batchStart();

  cb();

  batchEnd();
}
