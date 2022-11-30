import { Reaction } from '@reactiv/core';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

function useReactiv<T>(renderFn: () => T): T {
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
      reactionRef.current?.dispose();
      reactionRef.current = null;
    };
  }, []);

  let rendered!: T;

  reactionRef.current.trap(() => {
    rendered = renderFn();
  });

  return rendered;
}

export function reactor(component: FunctionComponent) {
  const wrappedComponent = (props: any) => {
    return useReactiv(() => component(props));
  };

  if (component.displayName) {
    wrappedComponent.displayName = component.displayName;
  } else if (component.name) {
    wrappedComponent.displayName = component.name;
  }

  return wrappedComponent;
}
