import { Reaction } from '@signalis/core';
import { type FunctionComponent, useEffect, useRef, useState } from 'react';

const Empty = [] as const;

function useSignalis<T>(renderFn: () => T): T {
  const [, setState] = useState();
  const forceUpdate = () => {
    setState([] as any);
  };

  const reactionRef = useRef<Reaction | null>(null);

  if (!reactionRef.current) {
    reactionRef.current = new Reaction(() => {
      forceUpdate();
    });
  }

  useEffect(() => {
    if (reactionRef.current) {
      forceUpdate();
    }
    if (!reactionRef.current) {
      reactionRef.current = new Reaction(() => {
        forceUpdate();
      });
      forceUpdate();
    }
    return () => {
      reactionRef.current!.dispose();
      reactionRef.current = null;
    };
  }, Empty);

  let rendered!: T;

  reactionRef.current.trap(() => {
    rendered = renderFn();
  });

  return rendered;
}

export function reactor<T extends {}>(component: FunctionComponent<T>) {
  const wrappedComponent = (props: T) => {
    return useSignalis(() => component(props));
  };

  if (component.displayName) {
    wrappedComponent.displayName = component.displayName;
  } else if (component.name) {
    wrappedComponent.displayName = component.name;
  }

  return wrappedComponent;
}
