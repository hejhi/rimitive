// Production integration of fast-signals with Lattice
// Minimal greenfield approach - just add subscribe for framework compatibility

import type { Signal as LatticeSignal, Computed as LatticeComputed } from '../../component/types';
import { signal as createFastSignal, writeSignal } from './signal';
import { computed as createFastComputed } from './computed';
import { effect as createFastEffect } from './effect';
import { batch as fastBatch } from './batch';
import { subscribe } from './subscribe';

// Create the signal factory for Lattice context
export function createFastSignalFactory() {
  return function signal<T>(initialValue: T): LatticeSignal<T> {
    const fastSignal = createFastSignal(initialValue);
    
    // Add subscribe method for framework compatibility
    const latticeSignal = Object.assign(fastSignal, {
      subscribe: (listener: () => void) => subscribe(fastSignal, listener)
    }) as LatticeSignal<T>;
    
    return latticeSignal;
  };
}

// Create the computed factory for Lattice context
export function createFastComputedFactory() {
  return function computed<T>(computeFn: () => T): LatticeComputed<T> {
    const fastComputed = createFastComputed(computeFn);
    
    // Add subscribe method for framework compatibility
    const latticeComputed = Object.assign(fastComputed, {
      subscribe: (listener: () => void) => subscribe(fastComputed, listener)
    }) as LatticeComputed<T>;
    
    return latticeComputed;
  };
}

// Create the effect factory for Lattice context
export function createFastEffectFactory() {
  return function effect(effectFn: () => void | (() => void)): () => void {
    let cleanupFn: (() => void) | void;
    
    // Create wrapped effect that handles cleanup
    const dispose = createFastEffect(() => {
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
export function createFastBatchFunction() {
  return fastBatch;
}

// Update function to be used by set()
export function updateFastSignalValue<T>(
  latticeSignal: LatticeSignal<T>,
  value: T
): void {
  // TypeScript doesn't know that LatticeSignal is compatible with FastSignal
  writeSignal(latticeSignal as unknown as Parameters<typeof writeSignal>[0], value);
}

// Compatibility checks
export function isFastSignal(signal: unknown): boolean {
  return typeof signal === 'function' && signal !== null && '_value' in signal;
}

// No-op since fast-signals handles its own tracking
export function setupFastSignalTracking(): void {
  // Fast-signals has its own tracking system
}