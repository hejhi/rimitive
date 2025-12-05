import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import type { Readable, Writable } from '@lattice/signals/types';

// Minimal service used by React bindings
export type SignalSvc = {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(compute: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
  dispose: () => void;
};

// Create the React Context
const SignalContext = createContext<SignalSvc | null>(null);

// Provider component
export type SignalProviderProps = {
  svc: SignalSvc;
  children: ReactNode;
};

export function SignalProvider({ svc, children }: SignalProviderProps) {
  // Dispose the service when the provider unmounts
  useEffect(() => {
    return () => svc.dispose();
  }, [svc]);

  return (
    <SignalContext.Provider value={svc}>{children}</SignalContext.Provider>
  );
}

// Hook to access the signal service
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
