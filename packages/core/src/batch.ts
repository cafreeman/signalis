import { batchCount, batchEnd, batchStart, runEffects } from './state';

export function batch(cb: () => void) {
  batchStart();

  cb();

  batchEnd();

  if (batchCount() === 0) {
    runEffects();
  }
}
