// Global state management for signals

import type { Computed, Effect } from './types';

export type SignalScope = {
  globalVersion: number;
  currentComputed: null;
  incrementGlobalVersion: () => void;
  setCurrentComputed: (computed: Computed | Effect | null) => void;
  getCurrentComputed: () => Computed | Effect | null;
  resetGlobalState: () => void;
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

  return {
    globalVersion,
    currentComputed,
    incrementGlobalVersion,
    setCurrentComputed,
    getCurrentComputed,
    resetGlobalState,
  };
}
