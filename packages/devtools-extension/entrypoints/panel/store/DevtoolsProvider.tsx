import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { SignalProvider } from '@rimitive/react';
import { devtoolsBehavior, type DevtoolsState } from './devtoolsBehavior';

const DevtoolsContext = createContext<DevtoolsState | null>(null);

type DevtoolsProviderProps = {
  children: ReactNode;
};

export function DevtoolsProvider({ children }: DevtoolsProviderProps) {
  const { svc, state } = useMemo(() => {
    const svc = compose(SignalModule, ComputedModule, EffectModule, BatchModule);
    const state = devtoolsBehavior(svc)();
    return { svc, state };
  }, []);

  // SignalProvider handles svc.dispose() on unmount
  return (
    <SignalProvider svc={svc}>
      <DevtoolsContext.Provider value={state}>
        {children}
      </DevtoolsContext.Provider>
    </SignalProvider>
  );
}

export function useDevtools(): DevtoolsState {
  const context = useContext(DevtoolsContext);
  if (!context) {
    throw new Error('useDevtools must be used within a DevtoolsProvider');
  }
  return context;
}
