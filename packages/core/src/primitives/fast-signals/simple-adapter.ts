/**
 * Simpler adapter that uses fast-signals more directly
 */

import { signal as createFastSignal, effect } from './index';
import type { Signal as FastSignal } from './types';

// Simple wrapper that exposes fast-signal directly but read-only
export function createSimpleSignal<T>(initialValue: T) {
  const fastSignal = createFastSignal(initialValue);
  
  // Create read-only wrapper
  const wrapper = (() => fastSignal()) as any;
  
  // Add subscribe using effect
  wrapper.subscribe = (listener: () => void) => {
    const dispose = effect(() => {
      fastSignal(); // Track the signal
      listener();
    });
    return dispose;
  };
  
  // Store fast signal for updates
  wrapper._fastSignal = fastSignal;
  
  return wrapper;
}

export function updateSimpleSignal<T>(signal: any, value: T | ((prev: T) => T)) {
  const fastSignal = signal._fastSignal as FastSignal<T>;
  
  if (typeof value === 'function') {
    const updater = value as (prev: T) => T;
    fastSignal(updater(fastSignal()));
  } else {
    fastSignal(value);
  }
}