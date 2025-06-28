/**
 * @fileoverview Scoped lattice context implementation
 * 
 * Provides isolated signal/computed contexts for component trees,
 * eliminating global state conflicts and enabling proper composition.
 */

import type { LatticeContext, SetState } from './runtime-types';
import type { SelectorResult } from './selector-types';
import { createTrackingContext } from './tracking';
import { createBatchingSystem } from './batching';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';


/**
 * Creates a scoped lattice context for a component tree
 */
export function createLatticeContext<State>(): LatticeContext<State> & { _batch: (fn: () => void) => void } {
  const tracking = createTrackingContext();
  const batching = createBatchingSystem();
  
  // Create bound factory functions
  const signal = createSignalFactory(tracking, batching);
  const computed = createComputedFactory(tracking, batching);
  
  // Placeholder set function - will be provided when creating store
  const set: SetState<State> = () => {
    throw new Error('set() is only available when component is connected to a store');
  };
  
  // Create select function
  const select = <TArgs extends any[], TResult>(
    selectorFn: (...args: TArgs) => TResult | undefined
  ) => {
    // Return a selector factory
    return (...args: TArgs): SelectorResult<TResult> => {
      // Run the selector to find the value
      const value = selectorFn(...args);
      
      // For now, return a basic selector result
      // We'll enhance this with caching and proper metadata later
      return {
        __selector: true,
        value,
        signal: null, // Will be set when we integrate with signals
        predicate: () => true, // Placeholder
      };
    };
  };
  
  return {
    signal,
    computed,
    set,
    select,
    // Internal method for store integration
    _batch: batching.batch,
  };
}