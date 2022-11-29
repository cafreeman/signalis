import { CleanupFn, ComputeFn, Reaction } from './reaction';
import {
  batchEnd,
  batchStart,
  getCurrentContext,
  setCurrentContext,
  setRunningReaction,
  setupCurrentContext,
} from './state';

export class LazyReaction extends Reaction {
  private sealed = false;

  constructor(fn: ComputeFn, dispose?: CleanupFn) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    super(() => {}, dispose);
    this._initialized = false;
    this._computeFn = fn;
  }

  trap(trapFn: () => void) {
    // if (this.sealed) {
    //   return;
    // }
    batchStart();
    const prevContext = getCurrentContext();
    const currentContext = setupCurrentContext(this);
    setRunningReaction(this);

    try {
      trapFn();
    } finally {
      this._deps = Array.from(currentContext);
      console.log('this._deps', this._deps);
      this.registerDependencies();
      setCurrentContext(prevContext);
      setCurrentContext(null);
      setRunningReaction(null);
      this.sealed = true;
      this._finalized = true;
      batchEnd();
    }
  }
}
