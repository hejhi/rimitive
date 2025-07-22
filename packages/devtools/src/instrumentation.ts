/**
 * @fileoverview DevTools instrumentation provider
 * 
 * Creates instrumentation contexts for lattice that enable debugging and profiling.
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { Signal, Computed, Effect } from '@lattice/signals';
import type { DevToolsOptions, DevToolsEventType } from './types';
import { createEventEmitter } from './events/emitter';
import { createDevToolsAPIManager } from './events/api';
import { createPrimitiveRegistry } from './tracking/registry';
import { ID_PREFIXES } from './constants';

let contextCounter = 0;

function generateContextId(): string {
  return `${ID_PREFIXES.CONTEXT}${++contextCounter}`;
}

/**
 * Creates an instrumentation context for debugging and profiling
 * 
 * @example
 * ```typescript
 * import { createContext } from '@lattice/lattice';
 * import { signalExtension, computedExtension } from '@lattice/lattice';
 * import { createInstrumentation } from '@lattice/devtools';
 * 
 * const instrumentation = createInstrumentation({ name: 'MyApp' });
 * 
 * const context = createContext(
 *   { instrumentation },
 *   signalExtension,
 *   computedExtension
 * );
 * ```
 */
export function createInstrumentation(options: DevToolsOptions = {}): InstrumentationContext {
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
  
  let resourceCounter = 0;
  
  return {
    contextId,
    contextName,
    
    emit(event: {
      type: string;
      timestamp: number;
      data: Record<string, unknown>;
    }) {
      eventEmitter.emit({
        type: event.type as DevToolsEventType,
        timestamp: event.timestamp,
        data: event.data,
        contextId,
      });
    },
    
    register<T>(resource: T, type: string, name?: string): { id: string; resource: T } {
      let id: string;
      
      // Register based on type
      switch (type) {
        case 'signal': {
          const tracked = registry.registerSignal(resource as Signal<unknown>, contextId, name);
          id = tracked.id;
          break;
        }
        case 'computed': {
          const tracked = registry.registerComputed(resource as Computed<unknown>, contextId, name);
          id = tracked.id;
          break;
        }
        case 'effect': {
          const tracked = registry.registerEffect(resource as Effect, contextId, name);
          id = tracked.id;
          break;
        }
        default:
          // For other types, generate a simple ID
          id = `${type}_${++resourceCounter}`;
      }
      
      return { id, resource };
    }
  };
}

/**
 * Enable global DevTools API
 * 
 * This makes the DevTools API available on the window object for browser extensions.
 */
export function enableDevTools(): void {
  const eventEmitter = createEventEmitter();
  const apiManager = createDevToolsAPIManager(eventEmitter);
  apiManager.initialize();
}