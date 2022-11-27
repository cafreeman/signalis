import { createEffect, Effect, isSignal } from '@reactiv/core';
import { Component, FunctionComponent, useMemo, useSyncExternalStore } from 'react';

const ProxyInstances = new WeakMap<FunctionComponent, FunctionComponent>();

const ProxyHandlers = {
  apply(Component: FunctionComponent, thisArg: any, argumentsList: any) {
    console.log('calling apply');
    const store = useMemo(createEffectStore, []);
    useSyncExternalStore(store.subscribe, store.getSnapshot);

    console.log('effect', store.updater);

    store.updater._start();

    try {
      const children = Component.apply(thisArg, argumentsList);
      return children;
    } finally {
      store.updater._stop();
    }
  },
};

export function useEffectStore() {
  const store = useMemo(createEffectStore, []);
  useSyncExternalStore(store.subscribe, store.getSnapshot);

  return store;
}

function createEffectStore() {
  console.log('create effect store');
  let version = 0;
  let updater!: Effect;
  let notify: (() => void) | undefined;

  const dispose = createEffect(function (this: Effect) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    updater = this;
  });

  updater._computeFn = () => {
    console.log('COMPUTE');
    if (version < 10) {
      version = version + 1;
    }
    notify && notify();
  };

  function subscribe(onStoreChange: () => void) {
    console.log('subscribe');
    notify = onStoreChange;

    return () => {
      console.log('unsubscribe');
      notify = undefined;
      version = version + 1;
      dispose();
    };
  }

  return {
    updater,
    subscribe,
    getSnapshot() {
      return version;
    },
  };
}

export function WrapWithProxy(Component: FunctionComponent) {
  const ProxyComponent = new Proxy(Component, ProxyHandlers);
  ProxyInstances.set(Component, ProxyComponent);
  ProxyInstances.set(ProxyComponent, ProxyComponent);
  return ProxyComponent;
}

export function ProxyFunctionalComponent(Component: FunctionComponent) {
  const result = ProxyInstances.get(Component);
  if (result) {
    console.log('cache hit');
  }
  return ProxyInstances.get(Component) || WrapWithProxy(Component);
}

// export function wrapComponent<P extends {}>(Component: React.FunctionComponent) {
//   const wrappedComponent = (props: P) => {
//     console.log('wrapped component');
//     const store = useEffectStore();

//     console.log('render component');
//     store.updater._start();
//     try {
//       return Component(props);
//     } finally {
//       store.updater._stop();
//     }
//   };

//   wrappedComponent.displayName = Component.displayName;
//   return wrappedComponent;
// }
