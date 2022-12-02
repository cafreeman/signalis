import { useEffect } from 'react';
import { reactor, createDerived, createSignal } from '@reactiv/react';

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

// function Counter() {
//   const [count, setCount] = useState(0);

//   const isOdd = useCallback(() => {
//     return count % 2 !== 0;
//   }, [count]);

//   useEffect(() => {
//     const interval = window.setInterval(() => {
//       setCount((prev) => prev + 1);
//     });

//     return () => window.clearInterval(interval);
//   }, []);

//   return (
//     <div>
//       <p>The count is {isOdd() ? 'odd' : 'even'}</p>
//       <p>Count: {count}</p>
//     </div>
//   );
// }

// export default Counter;

export default reactor(Counter);
