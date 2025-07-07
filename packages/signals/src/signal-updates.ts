// Signal update utilities
import type { Signal, WritableSignal } from './types';
import { createUnifiedScope } from './scope';

// Create global scope for batch
const globalScope = createUnifiedScope();

// Batch function that uses the global scope
export function batch<T>(fn: () => T): T {
  return globalScope.batch(fn);
}

// Set function for updating signal values
export function set<T>(signal: Signal<T> | WritableSignal<T>, value: T): void {
  (signal as WritableSignal<T>).value = value;
}