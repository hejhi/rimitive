/**
 * Production-Quality Custom State Adapter for Lattice Components
 * 
 * This adapter provides a minimal, high-performance state management solution
 * with full type safety and no external dependencies.
 */

import type { 
  StateAdapter, 
  StateStore 
} from '@lattice/core/adapters/state-adapter';
import type { SetState, GetState } from '@lattice/core/shared/types';

/**
 * Configuration options for the Custom adapter
 */
export interface CustomAdapterConfig {
  /**
   * Enable state change logging for debugging
   */
  enableLogging?: boolean;
  
  /**
   * Custom equality function for state comparison
   */
  equalityFn?: <T>(a: T, b: T) => boolean;
  
  /**
   * Name for debugging purposes
   */
  name?: string;
}

/**
 * Type-safe subscription listener
 */
type StateListener<T> = (state: T) => void;

/**
 * Custom state store implementation with minimal overhead
 */
class CustomStateStore<T> implements StateStore<T> {
  private state: T;
  private listeners = new Set<StateListener<T>>();
  private config: CustomAdapterConfig;

  constructor(initialState: T, config: CustomAdapterConfig = {}) {
    this.state = initialState;
    this.config = config;
    
    if (config.enableLogging) {
      console.log(`[${config.name || 'CustomStore'}] Initialized with state:`, initialState);
    }
  }

  get: GetState<T> = () => {
    return this.state;
  };

  set: SetState<T> = (partial, replace = false) => {
    const prevState = this.state;
    
    if (typeof partial === 'function') {
      // Type-safe function call
      const updater = partial as (state: T) => T | Partial<T>;
      const result = updater(this.state);
      
      if (replace) {
        this.state = result as T;
      } else {
        // Type-safe merge
        this.state = { ...this.state, ...result } as T;
      }
    } else {
      if (replace) {
        this.state = partial as T;
      } else {
        // Type-safe merge
        this.state = { ...this.state, ...partial } as T;
      }
    }
    
    // Check if state actually changed
    const hasChanged = this.config.equalityFn 
      ? !this.config.equalityFn(prevState, this.state)
      : prevState !== this.state;
    
    if (hasChanged) {
      if (this.config.enableLogging) {
        console.log(`[${this.config.name || 'CustomStore'}] State updated:`, {
          prev: prevState,
          next: this.state,
        });
      }
      
      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(this.state);
        } catch (error) {
          console.error('Error in state listener:', error);
        }
      });
    }
  };

  subscribe = (listener: StateListener<T>): (() => void) => {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  };

  destroy = (): void => {
    this.listeners.clear();
    
    if (this.config.enableLogging) {
      console.log(`[${this.config.name || 'CustomStore'}] Destroyed`);
    }
  };
}

/**
 * Production-quality Custom State Adapter
 * 
 * Provides minimal overhead with full type safety
 */
export class CustomStateAdapter<T> implements StateAdapter<T> {
  private config: CustomAdapterConfig;

  constructor(config: CustomAdapterConfig = {}) {
    this.config = config;
  }

  createStore(initialState: T): StateStore<T> {
    // Handle both direct state and factory functions
    let resolvedState: T;
    
    if (typeof initialState === 'function') {
      // Create a minimal { set, get } implementation for factory functions
      let tempState: T;
      
      const tempSet: SetState<T> = (partial, replace = false) => {
        if (typeof partial === 'function') {
          const updater = partial as (state: T) => T | Partial<T>;
          const result = updater(tempState);
          tempState = replace ? (result as T) : { ...tempState, ...result } as T;
        } else {
          tempState = replace ? (partial as T) : { ...tempState, ...partial } as T;
        }
      };
      
      const tempGet: GetState<T> = () => tempState;
      
      // Initialize with empty object and let factory define the state
      tempState = {} as T;
      
      // Type-safe factory function call
      const stateFactory = initialState as (params: { set: SetState<T>; get: GetState<T> }) => T;
      resolvedState = stateFactory({ set: tempSet, get: tempGet });
    } else {
      resolvedState = initialState;
    }

    return new CustomStateStore(resolvedState, this.config);
  }
}

/**
 * Factory function for creating custom state adapters
 */
export function createCustomAdapter<T>(
  config: CustomAdapterConfig = {}
): StateAdapter<T> {
  return new CustomStateAdapter<T>(config);
}

/**
 * Default shallow equality function for performance
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!(key in (b as Record<string, unknown>)) || 
        (a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Pre-configured custom adapter with shallow equality checking
 */
export function createCustomAdapterWithShallowEqual<T>(
  config: Omit<CustomAdapterConfig, 'equalityFn'> = {}
): StateAdapter<T> {
  return createCustomAdapter<T>({
    ...config,
    equalityFn: shallowEqual,
  });
}