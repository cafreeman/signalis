import { describe, expect, test } from 'vitest';
import { createSignal, reactor } from '../src';
import { render } from '@testing-library/react';

describe('React component setup', () => {
  test('it re-renders when a signal updates', () => {
    const foo = createSignal(0);

    function App() {
      return <div id="foo">{foo.value}</div>;
    }

    render(reactor(App));
  });
});
