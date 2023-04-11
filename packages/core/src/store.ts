import { type Signal, createSignal } from './signal.js';

export type NotWrappable = string | number | bigint | symbol | boolean | null | undefined;

export type Wrappable<T> = T extends NotWrappable ? never : T;

export function isWrappable<T>(v: T): v is Wrappable<T>;
export function isWrappable(v: any) {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v[$STOREPROXY] || Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype)
  );
}

function isGetter(
  v: PropertyDescriptor | undefined
): v is PropertyDescriptor & { get: () => unknown } {
  return !!(v && v.get);
}

export const $RAW = Symbol('store-target');
export const $NODES = Symbol('signal-nodes');
export const $STOREPROXY = Symbol('signal-store-proxy');
export const $SELF = Symbol('signal-store-self');

type SignalNodeMap = Record<PropertyKey, Signal<unknown>>;

export interface StoreNode {
  [$NODES]?: SignalNodeMap;
  [key: PropertyKey]: any;
}

type Store<T> = T;

function getSignalNodes(v: StoreNode): SignalNodeMap {
  let nodes = v[$NODES];
  if (!nodes) {
    nodes = {};
    Object.defineProperty(v, $NODES, { value: nodes });
  }

  return nodes;
}

function getSignalNode(nodesMap: SignalNodeMap, property: PropertyKey, value: unknown) {
  const result = nodesMap[property];

  if (result) {
    return result;
  }

  const signal = createSignal(value, false);
  nodesMap[property] = signal;
  return signal;
}

function trackSelf(node: StoreNode) {
  const nodes = getSignalNodes(node);
  if (!nodes[$SELF]) {
    (nodes[$SELF] = createSignal()).value;
  }
}

export const handler: ProxyHandler<StoreNode> = {
  get(target, prop, receiver) {
    const nodes = getSignalNodes(target);

    if (prop === $STOREPROXY) {
      return receiver;
    }

    if (prop === $RAW) {
      return target;
    }

    if (prop === $NODES) {
      return nodes;
    }

    if (prop === $SELF) {
      trackSelf(target);
      return receiver;
    }

    let node = nodes[prop];

    let value = node ? node.value : target[prop];

    if (!node) {
      const descriptor = Object.getOwnPropertyDescriptor(target, prop);
      if (typeof value !== 'function' && !isGetter(descriptor)) {
        node = getSignalNode(nodes, prop, value);
        value = node.value;
      }
    }

    if (isWrappable(value)) {
      return wrap(value);
    }

    return value;
  },

  set() {
    throw new Error(`Can't set properties directly on stores. Use \`update\` instead.`);
  },

  has(target, prop) {
    if (prop === $STOREPROXY || prop === $RAW || prop === $NODES) {
      return true;
    }

    this.get!(target, prop, target);

    return prop in target;
  },

  ownKeys(target) {
    trackSelf(target);
    return Reflect.ownKeys(target);
  },

  getOwnPropertyDescriptor(target, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
    if (
      !descriptor ||
      !descriptor.configurable ||
      prop === $NODES ||
      prop === $STOREPROXY ||
      prop === $SELF ||
      isGetter(descriptor)
    ) {
      return descriptor;
    }

    // if we're here, it means we're looking for the property descriptor of a value that should be
    // be wrapped. Since we want delegate any property access to the proxy, we convert the
    // descriptor from a data descriptor into an accessor descriptor whose getter returns the
    // value from the proxy.
    delete descriptor.value;
    delete descriptor.writable;

    descriptor.get = () => target[$STOREPROXY][prop];

    return descriptor;
  },
};

// `setProperty` manages the bookkeeping involved in updating a property on a store. It handles
// updating the property on both the underlying object and on the reactive wrapper that gets
// returned on property access. If the property hasn't been wrapped yet, we wrap it here before
// updating it.
export function setProperty(target: StoreNode, prop: PropertyKey, value: unknown) {
  const nodes = getSignalNodes(target);
  const length = target.length;

  const prev = target[prop];

  if (value === undefined) {
    delete target[prop];
  } else {
    target[prop] = value;
  }

  let node = getSignalNode(nodes, prop, prev);

  node.value = value;

  if (Array.isArray(target) && target.length !== length) {
    // Need to make sure we keep the lengths of arrays in sync between the underlying object
    // and the store node. By making an array's `length` property a signal node, we ensure that
    // its length is reactive and can be subscribed to
    node = getSignalNode(nodes, 'length', length);
    node.value = target.length;
  }

  // If this node is tracking itself, we poke the underlying signal to indicate that something
  // on it has changed.
  if (nodes[$SELF]) {
    nodes[$SELF].value = null;
  }
}

function wrap<T extends StoreNode>(v: T): T {
  let proxy = v[$STOREPROXY];

  if (proxy) {
    return proxy as T;
  }

  proxy = new Proxy(v, handler);
  Object.defineProperty(v, $STOREPROXY, { value: proxy });

  if (!Array.isArray(v)) {
    const keys = Object.keys(v);
    const descriptors = Object.getOwnPropertyDescriptors(v);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      const descriptor = descriptors[key];

      // re-bind any getters to the proxy instead of the undlerying object
      if (isGetter(descriptor)) {
        Object.defineProperty(v, key, {
          get: descriptor.get.bind(proxy),
          enumerable: !!descriptor.enumerable,
        });
      }
    }
  }

  return proxy as T;
}

// revert a store back to its non-reactive version. the result of `unwrap` is referentially identical
// to the original object that was passed to `createStore`
export function unwrap<T>(v: T, set?: Set<unknown>): T;
export function unwrap<T>(v: any, set = new Set()): T {
  let len, value, key: keyof typeof v, unwrapped;
  if (v != null && v[$RAW]) {
    return v[$RAW];
  }

  // If we couldn't have wrapped this in the first place *or* we've already unwrapped this value,
  // just return it as is
  if (!isWrappable(v) || set.has(v)) {
    return v;
  }

  // unwrap each member of an array or object and replace it in the original object (this is how
  // we maintain reference stability)
  if (Array.isArray(v)) {
    if (Object.isFrozen(v)) {
      v = v.slice(0);
    } else {
      set.add(v);
    }

    len = v.length;

    for (let i = 0; i < len; i++) {
      value = v[i];

      unwrapped = unwrap(value, set);
      if (unwrapped !== value) {
        v[i] = unwrapped;
      }
    }
  } else {
    if (Object.isFrozen(v)) {
      v = Object.assign({}, v);
    } else {
      set.add(v);
    }
    const keys = Object.keys(v);
    const descriptors = Object.getOwnPropertyDescriptors(v);

    len = keys.length;
    for (let i = 0; i < len; i++) {
      key = keys[i];
      if (!isGetter(descriptors[key])) {
        value = v[key];
        unwrapped = unwrap(value, set);
        if (unwrapped !== value) {
          v[key] = unwrapped;
        }
      }
    }
  }

  return v;
}

export function createStore<T extends object>(v: T | Store<T>): Store<T> {
  const unwrapped = unwrap(v);
  return wrap(unwrapped);
}
