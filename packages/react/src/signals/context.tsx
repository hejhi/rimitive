import React, { createContext, useContext, ReactNode } from 'react';
import type { SignalInterface } from '@lattice/signals/signal';
import type { ComputedInterface } from '@lattice/signals/computed';
import type { EffectDisposer } from '@lattice/signals/effect';
import type { Readable, ProducerNode } from '@lattice/signals/types';

// Minimal API shape used by React bindings
export interface SignalAPI {
  signal: <T>(value: T) => SignalInterface<T>;
  computed: <T>(compute: () => T) => ComputedInterface<T>;
  effect: (fn: () => void | (() => void)) => EffectDisposer;
  batch: <T>(fn: () => T) => T;
  subscribe: <T>(
    source: Readable<T> & ProducerNode,
    callback: (value: T) => void,
    options?: { skipEqualityCheck?: boolean }
  ) => () => void;
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
  return (
    <SignalContext.Provider value={api}>
      {children}
    </SignalContext.Provider>
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
