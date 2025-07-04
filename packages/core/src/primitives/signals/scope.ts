// Global state management for signals

import type { Computed, Effect } from './types';

export type SignalScope = {
  // Direct property access for hot path performance
  globalVersion: number;
  currentComputed: Computed | Effect | null;
  refreshGeneration: number;
  refreshCache: Map<Computed, boolean> | null;
  
  // Methods that modify state
  incrementGlobalVersion: () => void;
  resetGlobalState: () => void;
  startRefreshCycle: () => void;
  endRefreshCycle: () => void;
  checkRefreshCache: (computed: Computed) => boolean | undefined;
  setRefreshCache: (computed: Computed, result: boolean) => void;
};

export function createSignalScope(): SignalScope {
  const scope: SignalScope = {
    // Initialize properties
    globalVersion: 0,
    currentComputed: null,
    refreshGeneration: 0,
    refreshCache: null,
    
    // Methods
    incrementGlobalVersion(): void {
      scope.globalVersion++;
    },
    
    startRefreshCycle(): void {
      scope.refreshGeneration++;
      // Only allocate cache when needed
      if (!scope.refreshCache) {
        scope.refreshCache = new Map();
      }
    },
    
    endRefreshCycle(): void {
      // Clear cache to avoid memory leaks
      if (scope.refreshCache) {
        scope.refreshCache.clear();
      }
    },
    
    checkRefreshCache(computed: Computed): boolean | undefined {
      return scope.refreshCache?.get(computed);
    },
    
    setRefreshCache(computed: Computed, result: boolean): void {
      scope.refreshCache?.set(computed, result);
    },
    
    // For testing
    resetGlobalState(): void {
      scope.globalVersion = 0;
      scope.currentComputed = null;
      scope.refreshGeneration = 0;
      if (scope.refreshCache) {
        scope.refreshCache.clear();
      }
    },
  };
  
  return scope;
}
