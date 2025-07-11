/**
 * @fileoverview DevTools middleware for Lattice contexts
 *
 * Uses a hybrid approach that combines minimal wrapping with internal graph inspection
 * for low overhead and accurate dependency tracking.
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
  type DependencyInfo,
} from './dependency-utils';

interface TrackedPrimitive {
  id: string;
  name?: string;
  type: 'signal' | 'computed' | 'effect';
  ref: Signal<unknown> | Computed<unknown> | Effect;
}

// Registry to track all primitives and their metadata
const primitiveRegistry = new WeakMap<any, TrackedPrimitive>();

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

    // Helper to emit dependency snapshot
    function emitDependencySnapshot(
      primitive: TrackedPrimitive,
      trigger: 'created' | 'updated' | 'executed'
    ) {
      let dependencies: DependencyInfo[] = [];
      let subscribers: DependencyInfo[] = [];

      if (primitive.type === 'signal' || primitive.type === 'computed') {
        subscribers = getSubscribers(
          primitive.ref as Signal<unknown> | Computed<unknown>
        );
      }

      if (primitive.type === 'computed' || primitive.type === 'effect') {
        dependencies = getDependencies(
          primitive.ref as Computed<unknown> | Effect
        );
      }

      emitEvent({
        type: 'DEPENDENCY_UPDATE',
        contextId,
        timestamp: Date.now(),
        data: {
          id: primitive.id,
          type: primitive.type,
          trigger,
          dependencies: dependencies.map((d) => ({ id: d.id, name: d.name })),
          subscribers: subscribers.map((s) => ({ id: s.id, name: s.name })),
          value:
            primitive.type !== 'effect'
              ? getCurrentValue(
                  primitive.ref as Signal<unknown> | Computed<unknown>
                )
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
          ref: signal as Signal<T>,
        };

        trackedPrimitives.add(tracked);
        primitiveRegistry.set(signal, tracked);

        // Minimal instrumentation - only track writes for change detection
        const descriptor = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(signal),
          'value'
        );

        if (descriptor?.set) {
          const originalSet = descriptor.set;
          const originalGet = descriptor.get;

          Object.defineProperty(signal, 'value', {
            get() {
              const value = originalGet!.call(this);

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
              const oldValue = originalGet!.call(this);
              const result = originalSet.call(this, newValue);

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

        return signal as Signal<T>;
      },

      computed<T>(fn: () => T, name?: string): Computed<T> {
        const computedId = `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

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

            return result;
          } finally {
            currentExecutionContext = prevContext;
          }
        };

        const computed = context.computed(wrappedFn);

        const tracked: TrackedPrimitive = {
          id: computedId,
          name,
          type: 'computed',
          ref: computed as any,
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

        // Emit dependency snapshot after first execution
        setTimeout(() => {
          emitDependencySnapshot(tracked, 'created');
        }, 0);

        return computed as Computed<T>;
      },

      effect(fn: () => void | (() => void), name?: string): () => void {
        const effectId = `eff_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Track the effect for dependency analysis
        let effectRef: any = null;

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
              data: { id: effectId, name },
            });

            const cleanup = fn.call(this);

            emitEvent({
              type: 'EFFECT_END',
              contextId,
              timestamp: Date.now(),
              data: {
                id: effectId,
                name,
                duration: performance.now() - startTime,
                hasCleanup: typeof cleanup === 'function',
              },
            });

            // Emit dependency snapshot after execution
            if (effectRef) {
              const tracked = primitiveRegistry.get(effectRef);
              if (tracked) {
                setTimeout(() => {
                  emitDependencySnapshot(tracked, 'executed');
                }, 0);
              }
            }

            return cleanup;
          } finally {
            currentExecutionContext = prevContext;
          }
        };

        // Create the effect
        const dispose = context.effect(wrappedFn);

        // Create a reference object for the effect
        effectRef = {
          dispose,
          _sources: undefined, // Will be populated by Lattice
          _flags: 0,
        };

        const tracked: TrackedPrimitive = {
          id: effectId,
          name,
          type: 'effect',
          ref: effectRef as any,
        };

        trackedPrimitives.add(tracked);
        primitiveRegistry.set(effectRef, tracked);

        // Emit creation event
        emitEvent({
          type: 'EFFECT_CREATED',
          contextId,
          timestamp: Date.now(),
          data: { id: effectId, name },
        });

        // Return wrapped disposer
        return () => {
          trackedPrimitives.delete(tracked);
          dispose();

          emitEvent({
            type: 'EFFECT_DISPOSED',
            contextId,
            timestamp: Date.now(),
            data: { id: effectId, name },
          });
        };
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
            const allPrimitives = Array.from(trackedPrimitives).map(
              (t) => t.ref
            );
            const graph = buildDependencyGraph(allPrimitives);

            emitEvent({
              type: 'GRAPH_SNAPSHOT',
              contextId,
              timestamp: Date.now(),
              data: {
                nodes: Array.from(graph.nodes.values()),
                edges: graph.edges,
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
