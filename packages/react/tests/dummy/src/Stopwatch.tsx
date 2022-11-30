import { createDerived, createSignal } from '@reactiv/core';
import { useEffect } from 'react';
import { wrapComponent } from '../../../src';

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

  return <div>{timer.value}</div>;
}

export default wrapComponent(Stopwatch);
