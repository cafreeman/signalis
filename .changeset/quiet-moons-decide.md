---
'@signalis/react': patch
---

Fix a critical packaging bug and harden the hooks against React semantics:

- Externalize `@signalis/core` in the build. The react bundle previously embedded a private copy of core, and since core's reactivity graph lives in module-level state, apps that used both packages ended up with two independent reactive graphs: signals created via `@signalis/core` were invisible to `reactor`/hooks and vice versa. The bundle now imports `@signalis/core` (already a declared dependency) as a true external.
- `useSignal` now uses a `useState` lazy initializer instead of `useMemo`. React is permitted to discard a memo at any time, which could silently replace the signal and lose its state; the state initializer is guaranteed to run exactly once per component instance.
- `useDerived` was rewritten. The old implementation created deriveds inside `useMemo` as a side effect and never disposed the previous derived when deps changed (leaking it in its sources' observer lists), and it orphaned a derived on every StrictMode double render. The rewrite stores the derived in component state, replaces it via React's sanctioned adjust-state-during-render pattern when deps change, and ties disposal to committed renders via effect cleanup. Core dependency collection now defers graph subscriptions until React commits, so abandoned renders, including Suspense, cannot leak derived or reactor observers. Instance identity is stable across re-renders, and Strict Mode's simulated remounts re-activate the derived.
