import { createSignal, createDerived } from '@reactiv/core';
import { wrapComponent } from '../../../src';

const signal = createSignal(0);
const isOdd = createDerived(() => {
  return signal.value % 2 !== 0;
});
function Basic() {
  console.log('wat');

  return (
    <div>
      {isOdd.value ? <div>{signal.value} is odd</div> : <div>{signal.value} is even</div>}

      <button
        type="button"
        onClick={() => {
          signal.value++;
          console.log(signal.value);
        }}
      >
        Click Me
      </button>
    </div>
  );
}

export default wrapComponent(Basic);
