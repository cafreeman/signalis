import { Signal, createSignal, isSignal } from './signal.js';
import { traverse } from './utils.js';
import { untrack } from './untrack.js';

export function isObject(v: any): v is object {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isGetter(v: PropertyDescriptor | undefined): v is PropertyDescriptor & { get: () => any } {
  return !!(v && v.get);
}

const $NODES = Symbol('signal-nodes');
const $STOREPROXY = Symbol('signal-store-proxy');

type SignalNodeMap = Record<PropertyKey, Signal<unknown>>;

interface Store {
  [$NODES]: SignalNodeMap;
  [$STOREPROXY]: Store;
  [key: PropertyKey]: any;
}

interface StoreInput {
  [$NODES]?: SignalNodeMap;
  [$STOREPROXY]?: Store;
  [key: PropertyKey]: any;
}

function getSignalNodes(v: Store): SignalNodeMap {
  let nodes = v[$NODES];
  if (!nodes) {
    nodes = {};
    Object.defineProperty(v, $NODES, { value: nodes });
  }

  return nodes;
}
function getSignalNode(nodesMap: SignalNodeMap, property: PropertyKey, value: any) {
  const result = nodesMap[property];

  if (result) {
    return result;
  }

  const signal = createSignal(value, false);
  nodesMap[property] = signal;
  return signal;
}

export const handler: ProxyHandler<Store> = {
  get(target, prop) {
    const nodes = getSignalNodes(target);

    if (prop === $NODES) {
      return nodes;
    }

    const node = nodes[prop];

    let value = node ? node.value : target[prop];

    if (!node) {
      const descriptor = Object.getOwnPropertyDescriptor(target, prop);
      if (typeof value !== 'function' && !isGetter(descriptor))
        value = getSignalNode(nodes, prop, value).value;
    }

    if (isObject(value)) {
      return createStore(value);
    }

    return value;
  },

  set(target, prop, newValue) {
    const nodes = getSignalNodes(target);

    const prev = target[prop];

    target[prop] = newValue;

    const node = getSignalNode(nodes, prop, prev);

    node.value = newValue;

    return true;
  },

  ownKeys(target) {
    return Reflect.ownKeys(target);
  },

  getOwnPropertyDescriptor(target, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
    if (!descriptor || prop === $NODES || prop === $STOREPROXY || isGetter(descriptor)) {
      return descriptor;
    }

    delete descriptor.value;
    delete descriptor.writable;

    descriptor.get = () => target[$STOREPROXY][prop];

    return descriptor;
  },
};

export function createStore(v: StoreInput) {
  let proxy = v[$STOREPROXY];

  if (proxy) {
    return proxy;
  }

  const keys = Object.keys(v);
  const descriptors = Object.getOwnPropertyDescriptors(v);

  proxy = new Proxy(v, handler) as Store;
  Object.defineProperty(v, $STOREPROXY, { value: proxy });

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    const descriptor = descriptors[key];

    if (isGetter(descriptor)) {
      Object.defineProperty(v, key, {
        get: descriptor.get.bind(proxy),
        enumerable: !!descriptor.enumerable,
      });
    }
  }

  return proxy;
}
