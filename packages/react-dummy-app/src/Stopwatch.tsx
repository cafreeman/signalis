import { createDerived, createSignal, reactor, useSignalEffect } from '@signalis/react';
import { useEffect } from 'react';

function createStopwatch() {
  const rawTime = createSignal(new Date());

  const timer = createDerived(() => {
    const now = rawTime.value;

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).format(now);
  });

  let interval: number;

  const start = () => {
    interval = window.setInterval(() => {
      rawTime.value = new Date();
    }, 1000);
  };

  const stop = () => {
    clearInterval(interval);
  };

  return {
    timer,
    start,
    stop,
  };
}

const { timer, start, stop } = createStopwatch();

function Stopwatch() {
  useEffect(() => {
    start();

    return stop;
  }, []);

  useSignalEffect(() => {
    console.log(timer.value);
  });

  return (
    <div>
      <div>{timer.value}</div>

      <button
        type="button"
        className="p-2 border rounded bg-red-500 text-white"
        onClick={() => stop()}
      >
        Stop
      </button>

      <button
        type="button"
        className="p-2 border rounded bg-green-700 text-white"
        onClick={() => start()}
      >
        Start
      </button>
    </div>
  );
}

export default reactor(Stopwatch);
