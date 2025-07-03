// Global state management for signals

import type { Computed, Effect } from './types';

export type SignalScope = {
  incrementGlobalVersion: () => void;
  setCurrentComputed: (computed: Computed | Effect | null) => void;
  getCurrentComputed: () => Computed | Effect | null;
  resetGlobalState: () => void;
  getGlobalVersion: () => number;
};

export function createSignalScope(): SignalScope {
  // Global tracking state
  let globalVersion = 0;
  let currentComputed: Computed | Effect | null = null;

  function incrementGlobalVersion(): void {
    globalVersion++;
  }

  function setCurrentComputed(computed: Computed | Effect | null): void {
    currentComputed = computed;
  }

  function getCurrentComputed(): Computed | Effect | null {
    return currentComputed;
  }

  // For testing
  function resetGlobalState(): void {
    globalVersion = 0;
    currentComputed = null;
  }

  function getGlobalVersion(): number {
    return globalVersion;
  }

  return {
    incrementGlobalVersion,
    setCurrentComputed,
    getCurrentComputed,
    resetGlobalState,
    getGlobalVersion,
  };
}
