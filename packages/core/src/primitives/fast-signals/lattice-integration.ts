// Production integration of fast-signals with Lattice

import type { TrackingContext } from '../../tracking';
import type { BatchingSystem } from '../../batching';
import type { Signal as LatticeSignal, SignalFactory } from '../../types';
import { signal as createFastSignal, writeSignal } from './signal';
import { batch as fastBatch } from './batch';
import type { Signal as FastSignal } from './types';

// Map to track fast-signal instances for each Lattice signal
const signalMap = new WeakMap<LatticeSignal<any>, FastSignal<any>>();

// Convert fast-signal to Lattice signal API
function wrapFastSignal<T>(
  fastSignal: FastSignal<T>,
  tracking: TrackingContext
): LatticeSignal<T> {
  const latticeSignal = function (predicateOrKeyFn?: any, predicate?: any) {
    // TODO: Implement signal selectors for fast-signals
    // For now, only support basic read operation
    if (arguments.length > 0) {
      throw new Error('Signal selectors not yet implemented for fast-signals');
    }

    // Track dependency in Lattice's system
    tracking.track(latticeSignal);

    // Read from fast-signal (which handles its own tracking)
    return fastSignal();
  } as LatticeSignal<T>;

  // Store internal properties expected by Lattice
  (latticeSignal as any)._value = fastSignal._value;
  (latticeSignal as any)._version = fastSignal._version;
  (latticeSignal as any)._listeners = new Set();

  // Store the mapping
  signalMap.set(latticeSignal, fastSignal);

  // Subscribe method for Lattice compatibility
  latticeSignal.subscribe = (listener: () => void) => {
    (latticeSignal as any)._listeners.add(listener);
    return () => {
      (latticeSignal as any)._listeners.delete(listener);
    };
  };

  return latticeSignal;
}

// Create the signal factory for Lattice context
export function createFastSignalFactory(
  tracking: TrackingContext,
  batching: BatchingSystem
): SignalFactory {
  return function signal<T>(initialValue: T): LatticeSignal<T> {
    const fastSignal = createFastSignal(initialValue);
    return wrapFastSignal(fastSignal, tracking);
  };
}

// Update function to be used by set()
export function updateFastSignalValue<T>(
  latticeSignal: LatticeSignal<T>,
  value: T,
  batching: BatchingSystem
): void {
  const fastSignal = signalMap.get(latticeSignal);
  if (!fastSignal) {
    throw new Error('Signal not found in fast-signal map');
  }

  // Use fast-signal's batching if not already in a Lattice batch
  if (batching.batching) {
    // Already in a batch, just write directly
    writeSignal(fastSignal, value);
  } else {
    // Not in a batch, use fast-signal's batch
    fastBatch(() => {
      writeSignal(fastSignal, value);
    });
  }

  // Update Lattice signal's cached values
  (latticeSignal as any)._value = value;
  (latticeSignal as any)._version = fastSignal._version;

  // Notify Lattice listeners
  const listeners = (latticeSignal as any)._listeners;
  if (listeners && listeners.size > 0) {
    batching.scheduleUpdate(() => {
      for (const listener of listeners) {
        listener();
      }
    });
  }
}

// Check if a signal is a fast-signal
export function isFastSignal(signal: any): boolean {
  return signalMap.has(signal);
}

// Get the underlying fast-signal
export function getFastSignal<T>(
  latticeSignal: LatticeSignal<T>
): FastSignal<T> | undefined {
  return signalMap.get(latticeSignal);
}

// Temporary implementation until signal selectors are supported
export function isSignalSelector(value: unknown): boolean {
  // TODO: Implement proper signal selector check when selectors are implemented
  return false;
}

// Get the source signal from a signal selector
export function getSourceSignal<T>(
  signal: LatticeSignal<T> | any
): LatticeSignal<unknown> | undefined {
  // TODO: Implement when signal selectors are supported
  return undefined;
}

// Integrate fast-signal tracking with Lattice's tracking context
export function setupFastSignalTracking(tracking: TrackingContext): void {
  // Fast-signals and Lattice tracking work independently but complement each other:
  // - Fast-signals handle their own dependency graph internally
  // - Lattice's tracking is used for its own computed/effect systems
  // No additional setup needed as both systems track independently
}
