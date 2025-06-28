/**
 * @fileoverview Dependency tracking system for reactive computations
 * 
 * Provides scoped tracking contexts that capture signal dependencies
 * during computation execution.
 */

import type { Signal } from './runtime-types';

export interface TrackingContext {
  track<T>(signal: Signal<T>): void;
  capture<T>(fn: () => T): { value: T; deps: Set<Signal<any>> };
  isTracking(): boolean;
}

/**
 * Creates a tracking context for dependency tracking - scoped per component tree
 */
export function createTrackingContext(): TrackingContext {
  let dependencies: Set<Signal<any>> | null = null;
  
  function track<T>(signal: Signal<T>): void {
    if (dependencies) {
      dependencies.add(signal);
    }
  }
  
  function capture<T>(fn: () => T): { value: T; deps: Set<Signal<any>> } {
    const prevDeps = dependencies;
    dependencies = new Set();
    
    try {
      const value = fn();
      return { value, deps: dependencies };
    } finally {
      dependencies = prevDeps;
    }
  }
  
  function isTracking(): boolean {
    return dependencies !== null;
  }
  
  return { track, capture, isTracking };
}