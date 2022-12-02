import { render } from '@testing-library/react';
import { describe, test } from 'vitest';
import { createSignal, reactor } from '../src/index.js';

describe.skip('React component setup', () => {
  test('it re-renders when a signal updates', () => {
    const foo = createSignal(0);

    function App() {
      return <div id="foo">{foo.value}</div>;
    }

    render(reactor(App));
  });
});
