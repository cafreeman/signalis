import { batch } from './batch.js';
import { $RAW, type StoreNode, isWrappable, setProperty, unwrap, type Wrappable } from './store.js';

const UpdaterMap = new WeakMap<Wrappable<StoreNode>, Wrappable<StoreNode>>();

/**
 * `update` works by wrapping a store's underlying object in a new proxy that does two main things:
 * 1. Traps all write operations, unwraps the incoming value in case it's a store, and delegates the
 *  write to `setProperty`, which handles updating properties in stores
 * 2. Traps all read operations and makes sure that any properties that are accessed are also wrapped
 * in their own version of this proxy
 *
 * This proxy is the `draft` that then gets passed to the callback passed in as `update`'s second
 * argument. By managing all the writes and reads and delegating them to their respective store nodes,
 * we're able to allow users to mutate a draft object in whatever ways they like and then propagate
 * those changes to the store.
 */
const handler: ProxyHandler<StoreNode> = {
  get(target, prop) {
    if (prop === $RAW) {
      return target;
    }
    const value = target[prop];

    if (isWrappable(value)) {
      let updater = UpdaterMap.get(value);

      if (!updater) {
        UpdaterMap.set(value, (updater = new Proxy(value, handler)));
      }

      return updater;
    } else {
      return value;
    }
  },

  set(target, prop, value) {
    setProperty(target, prop, unwrap(value));
    return true;
  },

  deleteProperty(target, property) {
    setProperty(target, property, undefined);
    return true;
  },

  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
};

export function update<T extends object>(base: T, recipe: (draft: T) => void): T {
  if (isWrappable(base)) {
    let proxy: StoreNode | undefined;

    if (!(proxy = UpdaterMap.get(base))) {
      UpdaterMap.set(base, (proxy = new Proxy(unwrap(base), handler)));
    }

    batch(() => {
      // We know that the proxy exists here because of the if statement above
      // and we cast it to T because the draft that gets passed to `recipe` is functionally
      // identical to `base` due to how the Proxy behaves
      recipe(proxy! as T);
    });
  }

  return base;
}
