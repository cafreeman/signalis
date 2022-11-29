import { LazyReaction } from '@reactiv/core';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

function useReactive<T>(renderFn: () => T): T {
  const [, setState] = useState();
  const forceUpdate = () => {
    setState([] as any);
  };

  const reactionRef = useRef<LazyReaction | null>(null);

  if (!reactionRef.current) {
    reactionRef.current = new LazyReaction(() => {
      forceUpdate();
    });
  }

  useEffect(() => {
    if (reactionRef.current) {
      forceUpdate();
    }
    if (!reactionRef.current) {
      reactionRef.current = new LazyReaction(() => {
        forceUpdate();
      });
      forceUpdate();
      console.log(reactionRef.current._deps);
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

export function wrapComponent(component: FunctionComponent) {
  const wrappedComponent = (props: any) => {
    return useReactive(() => component(props));
  };

  wrappedComponent.displayName = component.displayName;

  return wrappedComponent;
}
