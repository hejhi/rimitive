/**
 * @fileoverview Dependency tracking system for reactive computations
 * 
 * Provides scoped tracking contexts that capture signal dependencies
 * during computation execution.
 */


// Type for anything that can be tracked (has subscribe method)
type Trackable = { subscribe: (listener: () => void) => () => void };

export interface TrackingContext {
  track(trackable: Trackable): void;
  capture<T>(fn: () => T): { value: T; deps: Set<Trackable> };
  isTracking(): boolean;
}

/**
 * Creates a tracking context for dependency tracking - scoped per component tree
 */
export function createTrackingContext(): TrackingContext {
  let dependencies: Set<Trackable> | null = null;
  
  function track(trackable: Trackable): void {
    if (dependencies) {
      dependencies.add(trackable);
    }
  }
  
  function capture<T>(fn: () => T): { value: T; deps: Set<Trackable> } {
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