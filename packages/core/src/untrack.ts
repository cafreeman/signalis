import { resumeTracking, suspendTracking } from './state.js';

export function untrack<T>(cb: () => T): T {
  suspendTracking();

  try {
    const result = cb();
    return result;
  } finally {
    resumeTracking();
  }
}
