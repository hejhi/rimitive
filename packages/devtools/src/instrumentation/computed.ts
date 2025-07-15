/**
 * Computed instrumentation for DevTools
 * 
 * This module handles the instrumentation of Computed primitives
 * for tracking execution, dependencies, and performance.
 */

import type { Computed, LatticeContext } from '@lattice/core';
import type { PrimitiveRegistry, TrackedComputed } from '../tracking/registry';
import type { EventEmitter } from '../events/emitter';
import type { DevToolsOptions } from '../types';
import { executionContext } from '../tracking/execution-context';
import { wrapSelectMethod } from '../tracking/selectors';
import { getDependencySnapshot } from './dependency-snapshot';

/**
 * Options for computed instrumentation
 */
export interface ComputedInstrumentationOptions {
  contextId: string;
  registry: PrimitiveRegistry;
  eventEmitter: EventEmitter;
  devToolsOptions: DevToolsOptions;
}

/**
 * Instrument a computed for DevTools tracking
 */
export function instrumentComputed<T>(
  context: LatticeContext,
  fn: () => T,
  name: string | undefined,
  options: ComputedInstrumentationOptions
): Computed<T> {
  // Create wrapped function that tracks execution
  const wrappedFn = createWrappedComputedFn(fn, name, options);
  
  // Create the computed
  const computed = context.computed(wrappedFn);
  
  // Register the computed
  const tracked = options.registry.registerComputed(computed, options.contextId, name);
  
  // Store tracked reference for the wrapper to use
  interface FunctionWithTracked {
    __tracked?: TrackedComputed;
  }
  (wrappedFn as FunctionWithTracked).__tracked = tracked;
  
  // Emit creation event
  options.eventEmitter.emit({
    type: 'COMPUTED_CREATED',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: { id: tracked.id, name },
  });
  
  // Update context count
  options.eventEmitter.emit({
    type: 'CONTEXT_CREATED',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: { id: options.contextId, name: 'computed' },
  });
  
  // Wrap select method
  wrapSelectMethod(computed, tracked, {
    contextId: options.contextId,
    registry: options.registry,
    eventEmitter: options.eventEmitter,
    trackReads: options.devToolsOptions.trackReads,
  });
  
  // Dependencies will be emitted after first execution
  
  return computed;
}

/**
 * Create a wrapped computed function that tracks execution
 */
interface FunctionWithTracked {
  __tracked?: TrackedComputed;
}

function createWrappedComputedFn<T>(
  fn: () => T,
  name: string | undefined,
  options: ComputedInstrumentationOptions
): () => T {
  const wrappedFn = function (this: unknown) {
    // Get tracked reference (set after computed creation)
    const tracked = (wrappedFn as FunctionWithTracked).__tracked;
    if (!tracked) {
      // Fallback if tracked not set yet
      return fn.call(this);
    }
    
    const startTime = performance.now();
    
    // Execute within context
    const result = executionContext.withContext(tracked.id, () => {
      // Emit start event
      options.eventEmitter.emit({
        type: 'COMPUTED_START',
        contextId: options.contextId,
        timestamp: Date.now(),
        data: { id: tracked.id, name },
      });
      
      // Execute the actual function
      return fn.call(this);
    });
    
    // Emit end event
    options.eventEmitter.emit({
      type: 'COMPUTED_END',
      contextId: options.contextId,
      timestamp: Date.now(),
      data: {
        id: tracked.id,
        name,
        duration: performance.now() - startTime,
        value: result,
      },
    });
    
    // Emit dependency update after execution
    setTimeout(() => {
      options.eventEmitter.emit(getDependencySnapshot(tracked, 'executed', options.registry));
    }, 0);
    
    return result;
  };
  
  return wrappedFn;
}