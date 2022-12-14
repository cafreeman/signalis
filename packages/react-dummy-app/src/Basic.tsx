import { reactor, useDerived, useSignal } from '@signalis/react';

function Basic() {
  const signal = useSignal(0);
  const isOdd = useDerived(() => {
    return signal.value % 2 !== 0;
  });

  return (
    <div>
      {isOdd.value ? <div>{signal.value} is odd</div> : <div>{signal.value} is even</div>}

      <button
        type="button"
        onClick={() => {
          signal.value++;
        }}
      >
        Click Me
      </button>
    </div>
  );
}

export default reactor(Basic);
