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

    // Apply dependencies gathered by the render that just committed. A
    // suspended or interrupted render never reaches this effect, so it
    // cannot mutate the live reactive graph.
    useEffect(() => {
      reactionRef.current?._commitSourceCollection();
    });

    useEffect(() => {
      // Strict Mode runs cleanup and setup without a render in between. Make
      // a fresh reaction and schedule a render to collect its sources again.
      if (!reactionRef.current) {
        reactionRef.current = new Reaction(() => {
          forceUpdate();
        });
      }

      // An ancestor layout effect may write a signal after this component
      // rendered but before the reaction's passive effect subscribed. Render
      // once after subscribing so the component observes that write.
      forceUpdate();

      return () => {
        reactionRef.current!.dispose();
        reactionRef.current = null;
      };
    }, EMPTY);

    let rendered!: any;

    reactionRef.current._beginSourceCollection();
    reactionRef.current.trap(() => {
      rendered = target.apply(thisArg, argArray);
    });

    return rendered;
  },
};

function createProxyComponent<T>(component: FunctionComponent<T>) {
  const proxyComponent = new Proxy(component, handler);
  ProxyStore.set(component, proxyComponent);
  return proxyComponent;
}

export function reactor<T extends {}>(component: FunctionComponent<T>) {
  const proxyComponent = ProxyStore.get(component);

  if (proxyComponent) {
    return proxyComponent;
  }

  return createProxyComponent<T>(component);
}
