import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import type { Readable, Writable } from '@rimitive/signals/types';

/**
 * Minimal service interface used by React bindings.
 * Contains the core methods for creating and managing signals.
 *
 * @example
 * ```tsx
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule, BatchModule } from '@rimitive/signals/extend';
 *
 * const svc: SignalSvc = compose(SignalModule, ComputedModule, EffectModule, BatchModule);
 * ```
 */
export type SignalSvc = {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(compute: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
  dispose: () => void;
};

// Create the React Context
const SignalContext = createContext<SignalSvc | null>(null);

/**
 * Props for the SignalProvider component.
 *
 * @example
 * ```tsx
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule, BatchModule } from '@rimitive/signals/extend';
 *
 * const props: SignalProviderProps = {
 *   svc: compose(SignalModule, ComputedModule, EffectModule, BatchModule),
 *   children: <App />
 * };
 * ```
 */
export type SignalProviderProps = {
  svc: SignalSvc;
  children: ReactNode;
};

/**
 * Provides a signal service to all descendant components.
 * Automatically disposes the service when the provider unmounts.
 *
 * @example
 * ```tsx
 * import { SignalProvider } from '@rimitive/react';
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule, BatchModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule, BatchModule);
 *
 * function App() {
 *   return (
 *     <SignalProvider svc={svc}>
 *       <MyApp />
 *     </SignalProvider>
 *   );
 * }
 * ```
 */
export function SignalProvider({
  svc,
  children,
}: SignalProviderProps): ReactNode {
  // Dispose the service when the provider unmounts
  useEffect(() => {
    return () => svc.dispose();
  }, [svc]);

  return (
    <SignalContext.Provider value={svc}>{children}</SignalContext.Provider>
  );
}

/**
 * Access the signal service from the nearest SignalProvider.
 * Throws an error if used outside a SignalProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const svc = useSignalSvc();
 *   const count = useRef(svc.signal(0));
 *
 *   useEffect(() => {
 *     return svc.effect(() => {
 *       console.log('Count changed:', count.current());
 *     });
 *   }, [svc]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useSignalSvc(): SignalSvc {
  const svc = useContext(SignalContext);
  if (!svc) {
    throw new Error(
      'useSignalSvc must be used within a SignalProvider. ' +
        'Make sure to wrap your app or component tree with <SignalProvider svc={...}>.'
    );
  }
  return svc;
}
