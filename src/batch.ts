import { MANAGER } from './manager';

export function batch(cb: () => void) {
  MANAGER.batchStart();

  cb();

  MANAGER.batchEnd();

  if (MANAGER.batchCount === 0) {
    MANAGER.runEffects();
  }
}
