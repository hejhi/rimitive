import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { Readable, Writable } from './hooks';

// Minimal API shape used by React bindings
export type SignalAPI = {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(compute: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
  dispose: () => void;
};

// Create the React Context
const SignalContext = createContext<SignalAPI | null>(null);

// Provider component
export type SignalProviderProps = {
  svc: SignalAPI;
  children: ReactNode;
};

export function SignalProvider({ svc, children }: SignalProviderProps) {
  // Dispose the API when the provider unmounts
  useEffect(() => {
    return () => svc.dispose();
  }, [svc]);

  return (
    <SignalContext.Provider value={svc}>{children}</SignalContext.Provider>
  );
}

// Hook to access the signal API
export function useSignalAPI(): SignalAPI {
  const api = useContext(SignalContext);
  if (!api) {
    throw new Error(
      'useSignalAPI must be used within a SignalProvider. ' +
        'Make sure to wrap your app or component tree with <SignalProvider api={...}>.'
    );
  }
  return api;
}
