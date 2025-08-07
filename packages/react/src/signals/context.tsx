import React, { createContext, useContext, ReactNode } from 'react';
import { createSignalAPI } from '@lattice/signals/api';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createSubscribeFactory } from '@lattice/signals/subscribe';

// Type for the signal API - use the actual return type
type SignalAPI = ReturnType<typeof createSignalAPI<{
  signal: typeof createSignalFactory;
  computed: typeof createComputedFactory;
  effect: typeof createEffectFactory;
  batch: typeof createBatchFactory;
  subscribe: typeof createSubscribeFactory;
}>>;

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