/**
 * Hybrid DevTools middleware that combines minimal wrapping with graph inspection
 * 
 * This gives us the best of both worlds:
 * - Execution timeline and performance metrics from selective wrapping
 * - Accurate dependency information from the internal graph
 * - Much lower overhead than wrapping everything
 */

import type { LatticeContext } from '@lattice/core';
import type { Signal, Computed, Effect } from '@lattice/signals';
import { emitEvent, initializeDevTools } from './events';
import type { DevToolsOptions } from './types';
import { 
  getSubscribers, 
  getDependencies, 
  getCurrentValue,
  buildDependencyGraph,
  type DependencyInfo 
} from './dependency-utils';

interface TrackedPrimitive {
  id: string;
  name?: string;
  type: 'signal' | 'computed' | 'effect';
  ref: Signal<unknown> | Computed<unknown> | Effect;
}

const primitiveRegistry = new WeakMap<any, TrackedPrimitive>();

/**
 * Minimal hybrid middleware - only tracks what's necessary
 */
export function withDevToolsHybrid(options: DevToolsOptions = {}) {
  return function instrumentContext(context: LatticeContext): LatticeContext {
    initializeDevTools(options);

    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const contextName = options.name || 'LatticeContext';
    
    // Track all primitives for graph inspection
    const trackedPrimitives = new Set<TrackedPrimitive>();

    // Emit context creation
    emitEvent({
      type: 'CONTEXT_CREATED',
      contextId,
      timestamp: Date.now(),
      data: { id: contextId, name: contextName },
    });

    // Helper to emit dependency snapshot
    function emitDependencySnapshot(primitive: TrackedPrimitive, eventType: string) {
      if (!options.trackDependencies) return;

      let dependencies: DependencyInfo[] = [];
      let subscribers: DependencyInfo[] = [];

      if (primitive.type === 'signal' || primitive.type === 'computed') {
        subscribers = getSubscribers(primitive.ref as Signal<unknown> | Computed<unknown>);
      }

      if (primitive.type === 'computed' || primitive.type === 'effect') {
        dependencies = getDependencies(primitive.ref as Computed<unknown> | Effect);
      }

      emitEvent({
        type: 'DEPENDENCY_SNAPSHOT',
        contextId,
        timestamp: Date.now(),
        data: {
          id: primitive.id,
          type: primitive.type,
          eventType,
          dependencies: dependencies.map(d => d.id),
          subscribers: subscribers.map(s => s.id),
          value: primitive.type !== 'effect' 
            ? getCurrentValue(primitive.ref as Signal<unknown> | Computed<unknown>)
            : undefined,
        },
      });
    }

    return {
      signal<T>(initialValue: T, name?: string): Signal<T> {
        const signal = context.signal(initialValue);
        const signalId = name || `sig_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const tracked: TrackedPrimitive = {
          id: signalId,
          name,
          type: 'signal',
          ref: signal,
        };
        
        trackedPrimitives.add(tracked);
        primitiveRegistry.set(signal, tracked);

        // Minimal instrumentation - only track writes
        const descriptor = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(signal),
          'value'
        );
        
        if (descriptor?.set) {
          const originalSet = descriptor.set;
          const originalGet = descriptor.get;
          
          Object.defineProperty(signal, 'value', {
            get: originalGet,
            set(newValue: T) {
              const oldValue = originalGet!.call(this);
              const result = originalSet.call(this, newValue);
              
              // Emit write event with dependency snapshot
              emitEvent({
                type: 'SIGNAL_WRITE',
                contextId,
                timestamp: Date.now(),
                data: {
                  id: signalId,
                  oldValue,
                  newValue,
                },
              });
              
              // Emit dependency snapshot after write
              emitDependencySnapshot(tracked, 'write');
              
              return result;
            },
            configurable: true,
          });
        }

        // Emit creation with initial dependency info
        emitEvent({
          type: 'SIGNAL_CREATED',
          contextId,
          timestamp: Date.now(),
          data: { id: signalId, name, initialValue },
        });
        
        // Snapshot dependencies after creation (in next tick)
        Promise.resolve().then(() => {
          emitDependencySnapshot(tracked, 'created');
        });

        return signal;
      },

      computed<T>(fn: () => T, name?: string): Computed<T> {
        const computedId = name || `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        // Only wrap if we need performance metrics
        const wrappedFn = options.trackComputations
          ? function(this: unknown) {
              const startTime = performance.now();
              try {
                return fn.call(this);
              } finally {
                emitEvent({
                  type: 'COMPUTED_EXECUTED',
                  contextId,
                  timestamp: Date.now(),
                  data: {
                    id: computedId,
                    duration: performance.now() - startTime,
                  },
                });
              }
            }
          : fn;

        const computed = context.computed(wrappedFn);

        const tracked: TrackedPrimitive = {
          id: computedId,
          name,
          type: 'computed',
          ref: computed,
        };
        
        trackedPrimitives.add(tracked);
        primitiveRegistry.set(computed, tracked);

        emitEvent({
          type: 'COMPUTED_CREATED',
          contextId,
          timestamp: Date.now(),
          data: { id: computedId, name },
        });
        
        // Snapshot dependencies after creation
        Promise.resolve().then(() => {
          emitDependencySnapshot(tracked, 'created');
        });

        return computed;
      },

      effect(fn: () => void | (() => void), name?: string): () => void {
        const effectId = name || `eff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        // We need to capture the effect reference
        let effectRef: Effect | null = null;
        
        // Wrap to capture execution and the effect reference
        const wrappedFn = function(this: unknown) {
          const startTime = performance.now();
          try {
            return fn.call(this);
          } finally {
            if (options.trackEffects) {
              emitEvent({
                type: 'EFFECT_EXECUTED',
                contextId,
                timestamp: Date.now(),
                data: {
                  id: effectId,
                  duration: performance.now() - startTime,
                },
              });
            }
            
            // Snapshot dependencies after execution
            if (effectRef) {
              const tracked = primitiveRegistry.get(effectRef);
              if (tracked) {
                emitDependencySnapshot(tracked, 'executed');
              }
            }
          }
        };

        // Create the effect and try to capture its reference
        const dispose = context.effect(wrappedFn);
        
        // This is a hack - we need to find the actual effect object
        // In practice, this might require changes to core Lattice
        // For now, we'll create a proxy
        effectRef = { dispose } as any;

        const tracked: TrackedPrimitive = {
          id: effectId,
          name,
          type: 'effect',
          ref: effectRef,
        };
        
        trackedPrimitives.add(tracked);
        primitiveRegistry.set(effectRef, tracked);

        emitEvent({
          type: 'EFFECT_CREATED',
          contextId,
          timestamp: Date.now(),
          data: { id: effectId, name },
        });

        return () => {
          trackedPrimitives.delete(tracked);
          dispose();
          
          emitEvent({
            type: 'EFFECT_DISPOSED',
            contextId,
            timestamp: Date.now(),
            data: { id: effectId },
          });
        };
      },

      batch(fn: () => void): void {
        context.batch(() => {
          fn();
          
          // After batch, emit full dependency graph if requested
          if (options.snapshotOnBatch) {
            const allPrimitives = Array.from(trackedPrimitives).map(t => t.ref);
            const graph = buildDependencyGraph(allPrimitives);
            
            emitEvent({
              type: 'DEPENDENCY_GRAPH',
              contextId,
              timestamp: Date.now(),
              data: {
                nodes: Array.from(graph.nodes.values()),
                edges: graph.edges,
              },
            });
          }
        });
      },

      dispose() {
        emitEvent({
          type: 'CONTEXT_DISPOSED',
          contextId,
          timestamp: Date.now(),
          data: { id: contextId, name: contextName },
        });
        
        trackedPrimitives.clear();
        context.dispose();
      },
    };
  };
}