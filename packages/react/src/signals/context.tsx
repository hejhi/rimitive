import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import type { ComputedFunction } from '@lattice/signals/computed';
import { SignalFunction } from '@lattice/signals/signal';

// Minimal API shape used by React bindings
export interface SignalAPI {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(compute: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
  dispose: () => void;
}

// Create the React Context
const SignalContext = createContext<SignalAPI | null>(null);

// Provider component
export interface SignalProviderProps {
  api: SignalAPI;
  children: ReactNode;
}

export function SignalProvider({ api, children }: SignalProviderProps) {
  // Dispose the API when the provider unmounts
  useEffect(() => {
    return () => api.dispose();
  }, [api]);

  return (
    <SignalContext.Provider value={api}>{children}</SignalContext.Provider>
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
