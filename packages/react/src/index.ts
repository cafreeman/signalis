import { useMemo, useSyncExternalStore, useRef, useState, useEffect } from 'react';
import type { FunctionComponent } from 'react';
import { LazyReaction } from '@reactiv/core';

// function createEffectStore() {
//   console.log('createEffectStore');
//   let version = 0;
//   let notifyReact: (() => void) | undefined = undefined;

//   const reaction = new LazyReaction(() => {
//     console.log('REACTION COMPUTE');
//     version++;
//     notifyReact && notifyReact();
//   });

//   return {
//     reaction,
//     subscribe(onStoreChange: () => void) {
//       console.log('subscribe');
//       notifyReact = onStoreChange;

//       return () => {
//         version++;
//         console.log('unsubscribe');
//         notifyReact = undefined;
//         reaction.dispose();
//       };
//     },
//     getSnapshot() {
//       return version;
//     },
//   };
// }

// export function wrapComponent(component: FunctionComponent) {
//   const wrappedComponent = (props: any) => {
//     let version = 0;
//     let notifyReact: (() => void) | undefined = undefined;

//     const reaction = new LazyReaction(() => {
//       console.log('REACTION COMPUTE');
//       version++;
//       notifyReact && notifyReact();
//     });

//     function subscribe(onStoreChange: () => void) {
//       console.log('subscribe');
//       notifyReact = onStoreChange;

//       return () => {
//         // version++;
//         console.log('unsubscribe');
//         notifyReact = undefined;
//         reaction.dispose();
//       };
//     }

//     function getSnapshot() {
//       return version;
//     }

//     useSyncExternalStore(subscribe, getSnapshot);

//     reaction.trap();

//     try {
//       return component(props);
//     } finally {
//       reaction.seal();
//       // console.log(reaction._deps);
//     }
//   };

//   return wrappedComponent;
// }

export function wrapComponent(component: FunctionComponent) {
  const wrappedComponent = (props: any) => {
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

    let rendered: any;

    reactionRef.current.trap(() => {
      rendered = component(props);
    });

    return rendered;
  };

  return wrappedComponent;
}
