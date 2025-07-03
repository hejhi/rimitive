// Production integration of signals with Lattice
// Minimal greenfield approach - just add subscribe for framework compatibility

import type {
  Signal as LatticeSignal,
  Computed as LatticeComputed,
} from '../../component/types';
import { signal as createSignal, writeSignal } from './signal';
import { computed as createComputed } from './computed';
import { effect as createEffect } from './effect';
import { batch } from './batch';
import { subscribe } from './subscribe';

// Create the signal factory for Lattice context
export function createSignalFactory() {
  return function signal<T>(initialValue: T): LatticeSignal<T> {
    const signalInstance = createSignal(initialValue);

    // Add subscribe method for framework compatibility
    const latticeSignal = Object.assign(signalInstance, {
      subscribe: (listener: () => void) => subscribe(signalInstance, listener),
    }) as LatticeSignal<T>;

    return latticeSignal;
  };
}

// Create the computed factory for Lattice context
export function createComputedFactory() {
  return function computed<T>(computeFn: () => T): LatticeComputed<T> {
    const computedInstance = createComputed(computeFn);

    // Add subscribe method for framework compatibility
    const latticeComputed = Object.assign(computedInstance, {
      subscribe: (listener: () => void) =>
        subscribe(computedInstance, listener),
    }) as LatticeComputed<T>;

    return latticeComputed;
  };
}

// Create the effect factory for Lattice context
export function createEffectFactory() {
  return function effect(effectFn: () => void | (() => void)): () => void {
    let cleanupFn: (() => void) | void;

    // Create wrapped effect that handles cleanup
    const dispose = createEffect(() => {
      // Run previous cleanup if exists
      if (cleanupFn) {
        cleanupFn();
      }

      // Run effect and capture new cleanup
      cleanupFn = effectFn();
    });

    // Return dispose function that also runs final cleanup
    return () => {
      dispose();
      if (cleanupFn) {
        cleanupFn();
      }
    };
  };
}

// Create the batch function for Lattice context
export function createBatchFunction() {
  return batch;
}

// Update function to be used by set()
export function updateSignalValue<T>(
  latticeSignal: LatticeSignal<T>,
  value: T
): void {
  // TypeScript doesn't know that LatticeSignal is compatible with Signal
  writeSignal(
    latticeSignal as unknown as Parameters<typeof writeSignal>[0],
    value
  );
}

// Compatibility checks
export function isSignal(signal: unknown): boolean {
  return typeof signal === 'function' && signal !== null && '_value' in signal;
}
