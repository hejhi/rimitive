/**
 * @fileoverview Minimal adapter layer that wraps fast-signals to provide Lattice's API
 * 
 * This maintains Lattice's read-only signals with separate set() function
 * while using fast-signals' efficient internals.
 */

import { signal as createFastSignal } from './index';
import type { Signal as FastSignal, DependencyNode } from './types';
import type { Signal } from '../../component/types';

// WeakMap to store the mapping from Lattice signals to fast-signals
const signalToFastSignal = new WeakMap<Signal<unknown>, FastSignal<unknown>>();

/**
 * Creates a read-only signal that wraps a fast-signal
 */
export function createSignal<T>(initialValue: T): Signal<T> {
  // Create the underlying fast-signal
  const fastSignal = createFastSignal(initialValue);
  
  // Create the read-only wrapper
  const signal = function(...args: any[]) {
    // Read operation
    if (args.length === 0) {
      return fastSignal();
    }
    
    // For now, don't support selectors - just throw
    throw new Error('Invalid signal operation. Signals are read-only. Use set() to update.');
  } as Signal<T>;
  
  // Add subscribe method using fast-signal's subscription mechanism
  signal.subscribe = (listener: () => void) => {
    // Track the signal in an effect-like way
    let node = fastSignal._targets;
    
    // Check if already subscribed
    while (node) {
      if ((node.target as any) === listener) {
        return () => {}; // Already subscribed
      }
      node = node.nextTarget;
    }
    
    // Create a simple subscription by adding to targets
    const subscription = {
      _notify: listener,
      _flags: 0,
      dispose: () => {
        // Remove from targets list
        let n = fastSignal._targets;
        let prev = undefined;
        
        while (n) {
          if (n.target === subscription) {
            if (prev) {
              prev.nextTarget = n.nextTarget;
            } else {
              fastSignal._targets = n.nextTarget;
            }
            if (n.nextTarget) {
              n.nextTarget.prevTarget = prev;
            }
            break;
          }
          prev = n;
          n = n.nextTarget;
        }
      }
    };
    
    // Add to signal's targets
    const newNode: DependencyNode = {
      source: fastSignal as FastSignal<unknown>,
      target: subscription as any,
      version: fastSignal._version,
      nextTarget: fastSignal._targets,
      prevTarget: undefined,
      prevSource: undefined,
      nextSource: undefined,
    };
    
    if (fastSignal._targets) {
      fastSignal._targets.prevTarget = newNode;
    }
    fastSignal._targets = newNode;
    
    return () => subscription.dispose();
  };
  
  // Store the mapping
  signalToFastSignal.set(signal as Signal<unknown>, fastSignal as FastSignal<unknown>);
  
  return signal;
}

/**
 * Updates a signal's value
 */
export function updateSignal<T>(signal: Signal<T>, value: T | ((prev: T) => T)): void {
  const fastSignal = signalToFastSignal.get(signal as Signal<unknown>);
  if (!fastSignal) {
    throw new Error('Invalid signal');
  }
  
  if (typeof value === 'function') {
    const updater = value as (prev: T) => T;
    fastSignal(updater(fastSignal() as T));
  } else {
    fastSignal(value);
  }
}