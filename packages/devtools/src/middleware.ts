/**
 * @fileoverview DevTools middleware for Lattice contexts
 *
 * Uses a hybrid approach that combines minimal wrapping with internal graph inspection
 * for low overhead and accurate dependency tracking.
 */

import type { LatticeContext, Signal, Computed, Effect } from '@lattice/core';
import { emitEvent, initializeDevTools } from './events';
import type { DevToolsOptions } from './types';
import {
  getSubscribers,
  getDependencies,
  getCurrentValue,
  type DependencyInfo,
} from './dependency-utils';

type TrackedPrimitive =
  | {
      id: string;
      name?: string;
      type: 'signal';
      ref: Signal<unknown>;
    }
  | {
      id: string;
      name?: string;
      type: 'computed';
      ref: Computed<unknown>;
    }
  | {
      id: string;
      name?: string;
      type: 'effect';
      ref: Effect;
    }
  | {
      id: string;
      name?: string;
      type: 'selector';
      sourceId: string;
      selector: string;
      ref: unknown; // Selected<T> doesn't have a common base type
    };

// Registry to track all primitives and their metadata
const primitiveRegistry = new WeakMap<
  Signal<unknown> | Computed<unknown> | Effect,
  TrackedPrimitive
>();

// Note: We can't use WeakMap for selectors as they don't extend a common base type
// Selectors are tracked in trackedPrimitives set but not in the registry

// Track the currently executing effect/computed for accurate context
let currentExecutionContext: string | null = null;

/**
 * Creates a devtools middleware that instruments a Lattice context
 */
export function withDevTools(options: DevToolsOptions = {}) {
  return function instrumentContext(context: LatticeContext): LatticeContext {
    // Initialize devtools if not already done
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
      data: {
        id: contextId,
        name: contextName,
      },
    });

    // Helper to wrap select method on signals/computed
    function wrapSelectMethod<T extends Signal<unknown> | Computed<unknown>>(
      source: T,
      sourceTracked: TrackedPrimitive
    ): void {
      const originalSelect = source.select;
      if (!originalSelect) return;

      // Override the select method with proper typing
      const wrappedSelect = function <R>(this: T, selector: (value: T extends Signal<infer U> ? U : T extends Computed<infer U> ? U : never) => R) {
        // Call the original select method
        const selected = originalSelect.call(this, selector as Parameters<typeof originalSelect>[0]);
        
        // Generate ID for this selector
        const selectorId = `sel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        // Extract selector function string for debugging
        const selectorString = selector.toString().length > 50 
          ? selector.toString().substring(0, 50) + '...' 
          : selector.toString();
        
        // Track the selector
        const trackedSelector: TrackedPrimitive = {
          id: selectorId,
          name: undefined,
          type: 'selector',
          sourceId: sourceTracked.id,
          selector: selectorString,
          ref: selected,
        };
        
        trackedPrimitives.add(trackedSelector);
        
        // Emit selector creation event
        emitEvent({
          type: 'SELECTOR_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: selectorId,
            sourceId: sourceTracked.id,
            sourceName: sourceTracked.name,
            sourceType: sourceTracked.type as 'signal' | 'computed',
            selector: selectorString,
          },
        });
        
        // Wrap the selected value's getter to track reads
        const descriptor = Object.getOwnPropertyDescriptor(selected, 'value');
        if (descriptor?.get) {
          // Store the getter in a const to avoid unbound method warning
          const boundGetter = descriptor.get.bind(selected);
          Object.defineProperty(selected, 'value', {
            get() {
              const result: unknown = boundGetter();
              
              // Emit selector read event if we're tracking reads
              if (currentExecutionContext) {
                emitEvent({
                  type: 'SIGNAL_READ',
                  contextId,
                  timestamp: Date.now(),
                  data: {
                    id: selectorId,
                    name: selectorString,
                    value: result,
                    internal: false,
                    executionContext: currentExecutionContext,
                    readContext: {
                      type: 'selector',
                      id: selectorId,
                      name: selectorString,
                    },
                  },
                });
              }
              
              return result;
            },
            enumerable: false,
            configurable: true,
          });
        }
        
        return selected;
      };
      
      // Type-safe assignment
      Object.defineProperty(source, 'select', {
        value: wrappedSelect,
        writable: true,
        enumerable: false,
        configurable: true
      });
    }

    // Helper to emit dependency snapshot
    function emitDependencySnapshot(
      primitive: TrackedPrimitive,
      trigger: 'created' | 'updated' | 'executed'
    ) {
      let dependencies: DependencyInfo[] = [];
      let subscribers: DependencyInfo[] = [];

      if (primitive.type === 'signal' || primitive.type === 'computed') {
        subscribers = getSubscribers(primitive.ref);
      }

      if (primitive.type === 'computed' || primitive.type === 'effect') {
        dependencies = getDependencies(primitive.ref);
      }

      // Map dependency info to use our tracked IDs
      const mapDependencyInfo = (info: DependencyInfo) => {
        if (!info.ref) {
          // No ref means we can't map to tracked ID
          return { id: info.id, name: info.name };
        }
        
        let tracked = primitiveRegistry.get(info.ref);
        
        // If not tracked yet, it might be from another context or not instrumented
        // Register it now with a generated ID
        if (!tracked) {
          const generatedId = `${info.type}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          
          // Create the appropriate tracked primitive based on type
          if (info.type === 'signal') {
            tracked = {
              id: generatedId,
              name: info.name,
              type: 'signal' as const,
              ref: info.ref as Signal<unknown>,
            };
          } else if (info.type === 'computed') {
            tracked = {
              id: generatedId,
              name: info.name,
              type: 'computed' as const,
              ref: info.ref as Computed<unknown>,
            };
          } else {
            tracked = {
              id: generatedId,
              name: info.name,
              type: 'effect' as const,
              ref: info.ref as Effect,
            };
          }
          
          primitiveRegistry.set(info.ref, tracked);
          // Don't add to trackedPrimitives as it's from another context
        }
        
        return {
          id: tracked.id,
          name: tracked.name || info.name,
        };
      };

      emitEvent({
        type: 'DEPENDENCY_UPDATE',
        contextId,
        timestamp: Date.now(),
        data: {
          id: primitive.id,
          type: primitive.type,
          trigger,
          dependencies: dependencies.map(mapDependencyInfo),
          subscribers: subscribers.map(mapDependencyInfo),
          value:
            primitive.type === 'signal' || primitive.type === 'computed'
              ? getCurrentValue(primitive.ref)
              : undefined,
        },
      });
    }

    return {
      signal<T>(initialValue: T, name?: string): Signal<T> {
        const signal = context.signal(initialValue);
        const signalId = `sig_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const tracked: TrackedPrimitive = {
          id: signalId,
          name,
          type: 'signal',
          ref: signal as Signal<unknown>,
        };

        trackedPrimitives.add(tracked);
        primitiveRegistry.set(signal, tracked);

        // Minimal instrumentation - only track writes for change detection
        const proto = Object.getPrototypeOf(signal) as object | null;
        const descriptor = proto
          ? Object.getOwnPropertyDescriptor(proto, 'value')
          : undefined;

        if (descriptor?.set && descriptor?.get) {
          const originalSet = descriptor.set.bind(signal);
          const originalGet = descriptor.get.bind(signal);

          Object.defineProperty(signal, 'value', {
            get() {
              const value = originalGet() as T;

              // Only emit reads if we're in development mode and tracking reads
              if (options.trackReads && currentExecutionContext) {
                emitEvent({
                  type: 'SIGNAL_READ',
                  contextId,
                  timestamp: Date.now(),
                  data: {
                    id: signalId,
                    name,
                    value,
                    executionContext: currentExecutionContext,
                  },
                });
              }

              return value;
            },
            set(newValue: T) {
              const oldValue = originalGet() as T;
              const result = originalSet(newValue);

              // Emit write event
              emitEvent({
                type: 'SIGNAL_WRITE',
                contextId,
                timestamp: Date.now(),
                data: {
                  id: signalId,
                  name,
                  oldValue,
                  newValue,
                },
              });

              // Emit dependency snapshot after write
              setTimeout(() => {
                emitDependencySnapshot(tracked, 'updated');
              }, 0);

              return result;
            },
            enumerable: descriptor.enumerable,
            configurable: true,
          });
        }

        // Emit creation event
        emitEvent({
          type: 'SIGNAL_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: signalId,
            name,
            initialValue,
          },
        });

        // Emit initial dependency snapshot (will be empty for signals)
        setTimeout(() => {
          emitDependencySnapshot(tracked, 'created');
        }, 0);

        // Wrap the select method to track selectors
        wrapSelectMethod(signal, tracked);

        return signal;
      },

      computed<T>(fn: () => T, name?: string): Computed<T> {
        const computedId = `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        // We'll set this after creating the computed
        // eslint-disable-next-line prefer-const
        let tracked: TrackedPrimitive;

        // Wrap to track execution context and performance
        const wrappedFn = function (this: unknown) {
          const startTime = performance.now();
          const prevContext = currentExecutionContext;
          currentExecutionContext = computedId;

          try {
            emitEvent({
              type: 'COMPUTED_START',
              contextId,
              timestamp: Date.now(),
              data: { id: computedId, name },
            });

            const result = fn.call(this);

            emitEvent({
              type: 'COMPUTED_END',
              contextId,
              timestamp: Date.now(),
              data: {
                id: computedId,
                name,
                duration: performance.now() - startTime,
                value: result,
              },
            });

            // Emit dependency update after execution
            // This ensures dependencies are properly tracked
            setTimeout(() => {
              if (tracked) {
                emitDependencySnapshot(tracked, 'executed');
              }
            }, 0);

            return result;
          } finally {
            currentExecutionContext = prevContext;
          }
        };

        const computed = context.computed(wrappedFn);

        tracked = {
          id: computedId,
          name,
          type: 'computed',
          ref: computed,
        };

        trackedPrimitives.add(tracked);
        primitiveRegistry.set(computed, tracked);

        // Emit creation event
        emitEvent({
          type: 'COMPUTED_CREATED',
          contextId,
          timestamp: Date.now(),
          data: { id: computedId, name },
        });

        // Dependencies will be emitted after first execution

        // Wrap the select method to track selectors
        wrapSelectMethod(computed, tracked);

        return computed;
      },

      effect(fn: () => void | (() => void)) {
        const effectId = `eff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        // Extract name if it exists on the function
        const name = fn.name || undefined;

        // Store a reference to the tracked primitive once it's created
        let trackedEffect: TrackedPrimitive | null = null;

        // Wrap to track execution context
        const wrappedFn = function (this: unknown) {
          const startTime = performance.now();
          const prevContext = currentExecutionContext;
          currentExecutionContext = effectId;

          try {
            emitEvent({
              type: 'EFFECT_START',
              contextId,
              timestamp: Date.now(),
              data: { id: effectId, name: undefined },
            });

            const cleanup = fn.call(this);

            emitEvent({
              type: 'EFFECT_END',
              contextId,
              timestamp: Date.now(),
              data: {
                id: effectId,
                name: undefined,
                duration: performance.now() - startTime,
                hasCleanup: typeof cleanup === 'function',
              },
            });

            // Emit dependency update after execution
            setTimeout(() => {
              if (trackedEffect) {
                emitDependencySnapshot(trackedEffect, 'executed');
              }
            }, 0);

            return cleanup;
          } finally {
            currentExecutionContext = prevContext;
          }
        };

        // Create the effect
        const disposer = context.effect(wrappedFn);
        
        // Get the effect instance from the disposer
        const effectRef = disposer.__effect;

        if (!effectRef) {
          console.warn('[DevTools] Effect instance not found on disposer');
          return disposer;
        }

        const tracked: TrackedPrimitive = {
          id: effectId,
          name: name || undefined,
          type: 'effect',
          ref: effectRef,
        };

        trackedPrimitives.add(tracked);
        primitiveRegistry.set(effectRef, tracked);
        
        // Store reference for the wrapper function
        trackedEffect = tracked;

        // Emit creation event
        emitEvent({
          type: 'EFFECT_CREATED',
          contextId,
          timestamp: Date.now(),
          data: { id: effectId, name },
        });

        // Dependencies will be emitted after first execution

        // Return the original disposer - no wrapping needed
        // If the effect is disposed, it will stop appearing in dependency updates
        // and the devtools can infer it's been disposed
        return disposer;
      },

      batch(fn: () => void): void {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        emitEvent({
          type: 'BATCH_START',
          contextId,
          timestamp: Date.now(),
          data: { id: batchId },
        });

        try {
          context.batch(fn);

          emitEvent({
            type: 'BATCH_END',
            contextId,
            timestamp: Date.now(),
            data: {
              id: batchId,
              success: true,
            },
          });

          // Optionally emit full graph snapshot after batch
          if (options.snapshotOnBatch !== false) {
            // Build dependency graph with consistent IDs
            const graphNodes: Array<{
              id: string;
              type: 'signal' | 'computed' | 'effect' | 'selector';
              name?: string;
              value?: unknown;
              isActive: boolean;
              // ref is only used internally for building the graph, not sent to devtools
            }> = [];
            const graphEdges: Array<{ source: string; target: string; isActive: boolean }> = [];
            
            // Create nodes with our tracked IDs
            for (const tracked of trackedPrimitives) {
              if (tracked.type === 'selector') {
                // For selectors, include the selector function string as part of the name
                graphNodes.push({
                  id: tracked.id,
                  type: tracked.type,
                  name: tracked.name || tracked.selector,
                  value: undefined, // Selectors don't store values
                  isActive: true,
                });
                // Add edge from source to selector
                graphEdges.push({
                  source: tracked.sourceId,
                  target: tracked.id,
                  isActive: true,
                });
              } else {
                graphNodes.push({
                  id: tracked.id,
                  type: tracked.type,
                  name: tracked.name,
                  value: tracked.type === 'signal' || tracked.type === 'computed' 
                  ? getCurrentValue(tracked.ref) 
                  : undefined,
                  isActive: true,
                });
              }
            }
            
            // Build edges using our IDs
            for (const tracked of trackedPrimitives) {
              if (tracked.type === 'computed' || tracked.type === 'effect') {
                const deps = getDependencies(tracked.ref);
                for (const dep of deps) {
                  // Find the tracked primitive for this dependency
                  const depTracked = dep.ref ? primitiveRegistry.get(dep.ref) : undefined;
                  if (depTracked) {
                    graphEdges.push({
                      source: depTracked.id,
                      target: tracked.id,
                      isActive: true,
                    });
                  }
                }
              }
            }

            emitEvent({
              type: 'GRAPH_SNAPSHOT',
              contextId,
              timestamp: Date.now(),
              data: {
                nodes: graphNodes,
                edges: graphEdges,
              },
            });
          }
        } catch (error) {
          emitEvent({
            type: 'BATCH_END',
            contextId,
            timestamp: Date.now(),
            data: {
              id: batchId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          });

          throw error;
        }
      },

      dispose() {
        // Emit disposal event
        emitEvent({
          type: 'CONTEXT_DISPOSED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: contextId,
            name: contextName,
          },
        });

        // Clear tracked primitives
        trackedPrimitives.clear();

        // Dispose the original context
        context.dispose();
      },
    };
  };
}
