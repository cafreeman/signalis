import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

describe('it works', () => {
  const Foo = () => {
    return <div id="test">hello</div>;
  };

  test('blah', () => {
    const { container } = render(<Foo />);

    expect(container.querySelector('#test')?.textContent).toEqual('hello');
  });
});
