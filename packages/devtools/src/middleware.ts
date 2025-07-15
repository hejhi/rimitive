/**
 * @fileoverview DevTools middleware for Lattice contexts
 *
 * Provides a clean, modular middleware that instruments Lattice contexts
 * for debugging and visualization with minimal performance overhead.
 */

import type { LatticeContext } from '@lattice/core';
import type { DevToolsOptions } from './types';
import { ID_PREFIXES } from './constants';
import { EventEmitter } from './events/emitter';
import { DevToolsAPIManager } from './events/api';
import { PrimitiveRegistry } from './tracking/registry';
import { instrumentSignal } from './instrumentation/signal';
import { instrumentComputed } from './instrumentation/computed';
import { instrumentEffect } from './instrumentation/effect';
import { instrumentBatch } from './instrumentation/batch';

/**
 * Creates a devtools middleware that instruments a Lattice context
 * 
 * @param options - Configuration options for the DevTools
 * @returns A middleware function that wraps a LatticeContext
 */
export function withDevTools(options: DevToolsOptions = {}) {
  return function instrumentContext(context: LatticeContext): LatticeContext {
    // Create context-specific instances
    const contextId = generateContextId();
    const contextName = options.name || 'LatticeContext';
    
    const eventEmitter = new EventEmitter({
      maxEvents: options.maxEvents,
    });
    
    const apiManager = new DevToolsAPIManager(eventEmitter);
    apiManager.initialize();
    
    const registry = new PrimitiveRegistry();
    
    // Register context
    apiManager.registerContext(contextId, contextName);
    
    // Emit context creation
    eventEmitter.emit({
      type: 'CONTEXT_CREATED',
      contextId,
      timestamp: Date.now(),
      data: {
        id: contextId,
        name: contextName,
      },
    });
    
    // Set up event listener to update context counts
    eventEmitter.emit = ((originalEmit) => {
      return (event) => {
        // Call original emit
        originalEmit.call(eventEmitter, event);
        
        // Update context counts based on event type
        switch (event.type) {
          case 'SIGNAL_CREATED':
            apiManager.updateContextCount(contextId, 'signal');
            break;
          case 'COMPUTED_CREATED':
            apiManager.updateContextCount(contextId, 'computed');
            break;
          case 'EFFECT_CREATED':
            apiManager.updateContextCount(contextId, 'effect');
            break;
        }
      };
    })(eventEmitter.emit.bind(eventEmitter));
    
    // Create instrumentation options
    const instrumentationOptions = {
      contextId,
      registry,
      eventEmitter,
      devToolsOptions: options,
    };
    
    // Return instrumented context
    return {
      signal<T>(initialValue: T, name?: string) {
        return instrumentSignal(context, initialValue, name, instrumentationOptions);
      },
      
      computed<T>(fn: () => T, name?: string) {
        return instrumentComputed(context, fn, name, instrumentationOptions);
      },
      
      effect(fn: () => void | (() => void)) {
        return instrumentEffect(context, fn, instrumentationOptions);
      },
      
      batch(fn: () => void) {
        return instrumentBatch(context, fn, instrumentationOptions);
      },
      
      dispose() {
        // Emit disposal event
        eventEmitter.emit({
          type: 'CONTEXT_DISPOSED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: contextId,
            name: contextName,
          },
        });
        
        // Clean up
        registry.clearContext(contextId);
        apiManager.unregisterContext(contextId);
        eventEmitter.destroy();
        
        // Dispose the original context
        context.dispose();
      },
    };
  };
}

/**
 * Generate a unique context ID
 */
function generateContextId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 9);
  return `${ID_PREFIXES.CONTEXT}_${timestamp}_${random}`;
}