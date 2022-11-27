import { batch, createEffect, createSignal, Effect, setOnTagDirtied } from '@reactiv/core';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

// function createStore() {
//   console.log('create store');
//   let clickCount = 0;
//   function subscribe(onStoreChange: () => void) {
//     console.log('subscribe');
//     function clickCounter() {
//       clickCount++;
//       onStoreChange();
//     }
//     window.addEventListener('click', clickCounter);

//     return () => window.removeEventListener('click', clickCounter);
//   }

//   return {
//     subscribe,
//     getSnapshot() {
//       return clickCount;
//     },
//   };
// }

// function useClickCounter() {
//   const store = useMemo(createStore, []);
//   return useSyncExternalStore(store.subscribe, store.getSnapshot);
// }

// function createTickerStore() {
//   let count = 0;

//   function subscribe(onStoreChange: () => void) {
//     const interval = window.setInterval(() => {
//       count++;
//       onStoreChange();
//     }, 1000);

//     return () => window.clearInterval(interval);
//   }

//   return {
//     subscribe,
//     getSnapshot() {
//       return count;
//     },
//   };
// }

// function useTicker() {
//   const store = useMemo(createTickerStore, []);
//   return useSyncExternalStore(store.subscribe, store.getSnapshot);
// }

function createEffectStore() {
  console.log('create effect store');
  // const count = createSignal(0);
  let version = 0;
  let updater!: Effect;
  let notify: (() => void) | undefined;

  setOnTagDirtied(() => {
    version++;
  });

  const dispose = createEffect(function (this: Effect) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    updater = this;
  });

  updater._computeFn = function () {
    console.log('effect compute');
    // version = version + 1;
    console.log('notify react', !!notify);
    notify && notify();
  };

  function subscribe(onStoreChange: () => void) {
    console.log('subscribe');
    notify = onStoreChange;

    return () => {
      console.log('unsubscribe');
      notify = undefined;
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

function useEffectStore() {
  // const store = createEffectStore();
  const store = useMemo(createEffectStore, []);
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  store.updater.compute();
}

function createTicker() {
  const count = createSignal(0);
  let interval: number;

  function start() {
    interval = window.setInterval(() => {
      console.log('tick');
      if (count.value < 10) count.value++;
    }, 1000);
  }

  function stop() {
    window.clearInterval(interval);
  }

  return {
    count,
    stop,
    start,
  };
}

export default function Blah() {
  // const clickCount = useClickCounter();
  // const count = useTicker();
  useEffectStore();

  const { count, stop, start } = createTicker();

  console.log('count', count.value);

  useEffect(() => {
    start();
    return stop;
  }, []);

  return <div>{count.value}</div>;
}
