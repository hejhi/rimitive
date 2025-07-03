// Global state management for fast-signals

import type { Computed, Effect } from './types';

// Global tracking state
export let globalVersion = 0;
export let currentComputed: Computed | Effect | null = null;

export function incrementGlobalVersion(): void {
  globalVersion++;
}

export function setCurrentComputed(computed: Computed | Effect | null): void {
  currentComputed = computed;
}

export function getCurrentComputed(): Computed | Effect | null {
  return currentComputed;
}

// For testing
export function resetGlobalState(): void {
  globalVersion = 0;
  currentComputed = null;
}
