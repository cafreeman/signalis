import { Reaction } from '@signalis/core';
import { useEffect, useReducer, useRef, type FunctionComponent } from 'react';
import { EMPTY } from './empty.js';

// So we only wrap each component one time rather than re-creating the proxy on every render
const ProxyStore = new WeakMap<FunctionComponent<any>, FunctionComponent<any>>();

function safeIncrement(x: number) {
  if (x === Number.MAX_SAFE_INTEGER) {
    return 0;
  }

  return x + 1;
}

const handler: ProxyHandler<FunctionComponent<any>> = {
  apply(target, thisArg, argArray: any) {
    const [, forceUpdate] = useReducer(safeIncrement, 0);

    const reactionRef = useRef<Reaction | null>(null);

    if (!reactionRef.current) {
      reactionRef.current = new Reaction(() => {
        forceUpdate();
      });
    }

    useEffect(() => {
      if (reactionRef.current) {
        forceUpdate();
      }
      // Because strict mode can cause multiple mount/unmount cycles, we have to catch cases where
      // this effect is running on a re-mount (and therefore has already disposed the initial reaction)
      // and re-create the Reaction
      if (!reactionRef.current) {
        reactionRef.current = new Reaction(() => {
          forceUpdate();
        });
        forceUpdate();
      }
      return () => {
        reactionRef.current!.dispose();
        reactionRef.current = null;
      };
    }, EMPTY);

    let rendered!: any;

    reactionRef.current.trap(() => {
      rendered = target.apply(thisArg, argArray);
    });

    return rendered;
  },
};

function createProxyComponent<T>(component: FunctionComponent<T>) {
  const proxyComponent = new Proxy(component, handler);
  ProxyStore.set(proxyComponent, proxyComponent);
  return proxyComponent;
}

export function reactor<T extends {}>(component: FunctionComponent<T>) {
  const proxyComponent = ProxyStore.get(component);

  if (proxyComponent) {
    return proxyComponent;
  }

  return createProxyComponent<T>(component);
}
