/**
 * @fileoverview DevTools extension for the Lattice extension system
 * 
 * Provides a devtools extension that can be added to any context to enable
 * debugging and profiling capabilities.
 */

import type { LatticeExtension, ExtensionContext } from '@lattice/lattice';
import type { DevToolsOptions } from './types';
import { createEventEmitter } from './events/emitter';
import { createDevToolsAPIManager } from './events/api';
import { createPrimitiveRegistry } from './tracking/registry';
import { instrumentSignal } from './instrumentation/signal';
import { instrumentComputed } from './instrumentation/computed';
import { instrumentEffect } from './instrumentation/effect';
import { instrumentBatch } from './instrumentation/batch';
import { ID_PREFIXES } from './constants';

let contextCounter = 0;

function generateContextId(): string {
  return `${ID_PREFIXES.CONTEXT}${++contextCounter}`;
}

/**
 * Creates a DevTools extension that instruments all other extensions
 * 
 * @example
 * ```typescript
 * import { createContext } from '@lattice/lattice';
 * import { signalExtension, computedExtension } from '@lattice/lattice';
 * import { devtoolsExtension } from '@lattice/devtools';
 * 
 * const context = createContext(
 *   devtoolsExtension({ name: 'MyApp' }),
 *   signalExtension,
 *   computedExtension
 * );
 * ```
 */
export function devtoolsExtension(options: DevToolsOptions = {}): LatticeExtension<'__devtools', never> {
  return {
    name: '__devtools',
    method: null as never, // No public method
    
    onCreate(ctx: ExtensionContext) {
      // Create devtools instances
      const contextId = generateContextId();
      const contextName = options.name || 'LatticeContext';
      
      const eventEmitter = createEventEmitter({
        maxEvents: options.maxEvents,
      });
      
      const apiManager = createDevToolsAPIManager(eventEmitter);
      apiManager.initialize();
      
      const registry = createPrimitiveRegistry();
      
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
      
      // Store devtools state on the extension context
      (ctx as any).__devtools = {
        contextId,
        contextName,
        eventEmitter,
        apiManager,
        registry,
        options,
      };
      
      // Register disposal cleanup
      ctx.onDispose(() => {
        eventEmitter.emit({
          type: 'CONTEXT_DISPOSED',
          contextId,
          timestamp: Date.now(),
          data: { id: contextId },
        });
        
        apiManager.unregisterContext(contextId);
      });
    },
    
    // This extension doesn't have a wrap method - the wrapping happens in withDevToolsInstrumentation
  };
}

/**
 * Higher-order extension that wraps another extension with devtools instrumentation
 * 
 * @internal
 */
export function withDevToolsInstrumentation<T extends LatticeExtension<string, any>>(
  extension: T,
  getDevTools: () => any
): T {
  const wrappedExtension = { ...extension };
  
  const originalWrap = extension.wrap;
  
  // Instrument based on extension name
  switch (extension.name) {
    case 'signal':
      wrappedExtension.wrap = function(method, ctx) {
        const baseMethod = originalWrap ? originalWrap(method, ctx) : method;
        const devtools = getDevTools();
        if (!devtools) return baseMethod;
        
        // Wrap the signal creation function
        return function <T>(initialValue: T, name?: string) {
          return instrumentSignal(
            baseMethod,
            initialValue,
            name,
            {
              contextId: devtools.contextId,
              registry: devtools.registry,
              eventEmitter: devtools.eventEmitter,
              devToolsOptions: devtools.options
            }
          );
        } as typeof baseMethod;
      };
      break;
      
    case 'computed':
      wrappedExtension.wrap = function(method, ctx) {
        const baseMethod = originalWrap ? originalWrap(method, ctx) : method;
        const devtools = getDevTools();
        if (!devtools) return baseMethod;
        
        // Wrap the computed creation function
        return function <T>(fn: () => T, name?: string) {
          return instrumentComputed(
            baseMethod,
            fn,
            name,
            {
              contextId: devtools.contextId,
              registry: devtools.registry,
              eventEmitter: devtools.eventEmitter,
              devToolsOptions: devtools.options
            }
          );
        } as typeof baseMethod;
      };
      break;
      
    case 'effect':
      wrappedExtension.wrap = function(method, ctx) {
        const baseMethod = originalWrap ? originalWrap(method, ctx) : method;
        const devtools = getDevTools();
        if (!devtools) return baseMethod;
        
        // Wrap the effect creation function
        return function (fn: () => void | (() => void)) {
          return instrumentEffect(
            baseMethod,
            fn,
            {
              contextId: devtools.contextId,
              registry: devtools.registry,
              eventEmitter: devtools.eventEmitter,
              devToolsOptions: devtools.options
            }
          );
        } as typeof baseMethod;
      };
      break;
      
    case 'batch':
      wrappedExtension.wrap = function(method, ctx) {
        const baseMethod = originalWrap ? originalWrap(method, ctx) : method;
        const devtools = getDevTools();
        if (!devtools) return baseMethod;
        
        // Wrap the batch function
        return function (fn: () => void) {
          return instrumentBatch(
            baseMethod,
            fn,
            {
              contextId: devtools.contextId,
              registry: devtools.registry,
              eventEmitter: devtools.eventEmitter,
              devToolsOptions: devtools.options
            }
          );
        } as typeof baseMethod;
      };
      break;
      
    case 'select':
      wrappedExtension.wrap = function(method, ctx) {
        const baseMethod = originalWrap ? originalWrap(method, ctx) : method;
        const devtools = getDevTools();
        if (!devtools) return baseMethod;
        
        // TODO: Add select instrumentation
        return baseMethod;
      };
      break;
      
    case 'subscribe':
      wrappedExtension.wrap = function(method, ctx) {
        const baseMethod = originalWrap ? originalWrap(method, ctx) : method;
        const devtools = getDevTools();
        if (!devtools) return baseMethod;
        
        // TODO: Add subscribe instrumentation
        return baseMethod;
      };
      break;
  }
  
  return wrappedExtension;
}

