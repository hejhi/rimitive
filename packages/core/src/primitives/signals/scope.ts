// Global state management for signals

import type { Computed, Effect } from './types';

export type SignalScope = {
  // Direct property access for hot path performance
  globalVersion: number;
  currentComputed: Computed | Effect | null;
  
  // Methods that modify state
  incrementGlobalVersion: () => void;
  resetGlobalState: () => void;
};

export function createSignalScope(): SignalScope {
  const scope: SignalScope = {
    // Initialize properties
    globalVersion: 0,
    currentComputed: null,
    
    // Methods
    incrementGlobalVersion(): void {
      scope.globalVersion++;
    },
    
    // For testing
    resetGlobalState(): void {
      scope.globalVersion = 0;
      scope.currentComputed = null;
    },
  };
  
  return scope;
}
