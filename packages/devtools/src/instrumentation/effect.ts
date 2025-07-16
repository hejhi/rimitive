/**
 * Effect instrumentation for DevTools
 * 
 * This module handles the instrumentation of Effect primitives
 * for tracking execution, cleanup, and dependencies.
 */

import type { EffectDisposer } from '@lattice/signals';
import type { LatticeContext } from '@lattice/core';
import type { PrimitiveRegistry, TrackedEffect } from '../tracking/registry';
import type { EventEmitter } from '../events/emitter';
import type { DevToolsOptions } from '../types';
import { executionContext } from '../tracking/execution-context';
import { getDependencySnapshot } from './dependency-snapshot';

/**
 * Options for effect instrumentation
 */
export interface EffectInstrumentationOptions {
  contextId: string;
  registry: PrimitiveRegistry;
  eventEmitter: EventEmitter;
  devToolsOptions: DevToolsOptions;
}

/**
 * Instrument an effect for DevTools tracking
 */
export function instrumentEffect(
  context: LatticeContext,
  fn: () => void | (() => void),
  options: EffectInstrumentationOptions
): EffectDisposer {
  // Extract name if it exists on the function
  const name = fn.name || undefined;
  
  // Reference to tracked effect (set after creation)
  let trackedEffect: TrackedEffect | null = null;
  
  // Create wrapped function that tracks execution
  const wrappedFn = function (this: unknown) {
    const effectId = trackedEffect?.id || 'pending';
    const startTime = performance.now();
    
    // Execute within context
    const cleanup = executionContext.withContext(effectId, () => {
      // Emit start event
      options.eventEmitter.emit({
        type: 'EFFECT_START',
        contextId: options.contextId,
        timestamp: Date.now(),
        data: { id: effectId, name },
      });
      
      // Execute the actual function
      return fn.call(this);
    });
    
    // Emit end event
    options.eventEmitter.emit({
      type: 'EFFECT_END',
      contextId: options.contextId,
      timestamp: Date.now(),
      data: {
        id: effectId,
        name,
        duration: performance.now() - startTime,
        hasCleanup: typeof cleanup === 'function',
      },
    });
    
    // Emit dependency update after execution
    if (trackedEffect) {
      setTimeout(() => {
        options.eventEmitter.emit(getDependencySnapshot(trackedEffect!, 'executed', options.registry));
      }, 0);
    }
    
    return cleanup;
  };
  
  // Create the effect
  const disposer = context.effect(wrappedFn);
  
  // Get the effect instance from the disposer
  const effectRef = disposer.__effect;
  
  if (!effectRef) {
    console.warn('[DevTools] Effect instance not found on disposer');
    return disposer;
  }
  
  // Register the effect
  const tracked = options.registry.registerEffect(effectRef, options.contextId, name);
  trackedEffect = tracked;
  
  // Emit creation event
  options.eventEmitter.emit({
    type: 'EFFECT_CREATED',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: { id: tracked.id, name },
  });
  
  // Update context count
  options.eventEmitter.emit({
    type: 'CONTEXT_CREATED',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: { id: options.contextId, name: 'effect' },
  });
  
  // Wrap the disposer to track disposal
  return createWrappedDisposer(disposer, tracked.id, options);
}

/**
 * Create a wrapped disposer that tracks effect disposal
 */
function createWrappedDisposer(
  originalDisposer: EffectDisposer,
  effectId: string,
  options: Pick<EffectInstrumentationOptions, 'contextId' | 'eventEmitter'>
): EffectDisposer {
  const wrappedDisposer = () => {
    // Call original disposer
    const result = originalDisposer();
    
    // Emit disposal event
    options.eventEmitter.emit({
      type: 'EFFECT_DISPOSED',
      contextId: options.contextId,
      timestamp: Date.now(),
      data: { id: effectId },
    });
    
    return result;
  };
  
  // Copy over any properties from original disposer
  const prototype = Object.getPrototypeOf(originalDisposer) as object | null;
  if (prototype) {
    Object.setPrototypeOf(wrappedDisposer, prototype);
  }
  Object.assign(wrappedDisposer, originalDisposer);
  
  // Ensure the wrapped disposer has the required __effect property
  const wrappedWithEffect = wrappedDisposer as EffectDisposer;
  wrappedWithEffect.__effect = originalDisposer.__effect;
  
  return wrappedWithEffect;
}