import { useEffect } from 'react';
import { reactor, createDerived, createSignal } from '@signalis/react';

function createCounter() {
  const count = createSignal(0);

  const isOdd = createDerived(() => {
    return count.value % 2 !== 0;
  });

  let interval: number;

  const start = () => {
    interval = window.setInterval(() => {
      count.value++;
    });
  };

  const stop = () => {
    clearInterval(interval);
  };

  return {
    count,
    isOdd,
    start,
    stop,
  };
}

const { count, isOdd, start, stop } = createCounter();

function Counter() {
  useEffect(() => {
    start();

    return stop;
  }, []);

  return (
    <div>
      <p>The count is {isOdd.value ? 'odd' : 'even'}</p>
      <p>Count: {count.value}</p>
    </div>
  );
}

export default reactor(Counter);
