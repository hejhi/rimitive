/**
 * @fileoverview DevTools middleware for Lattice contexts
 *
 * Provides instrumentation for signals, computed values, and effects
 * without modifying the core Lattice implementation.
 */

import type { LatticeContext } from '@lattice/core';
import type { Signal, Computed } from '@lattice/signals';
import { emitEvent, initializeDevTools } from './events';
import type { DevToolsOptions } from './types';

// Global execution context tracking
let currentExecutionContext: string | null = null;

function getCurrentExecutionContext(): string | null {
  return currentExecutionContext;
}

function setCurrentExecutionContext(context: string | null): void {
  currentExecutionContext = context;
}

/**
 * Creates a devtools middleware that instruments a Lattice context
 */
export function withDevTools(options: DevToolsOptions = {}) {
  return function instrumentContext(context: LatticeContext): LatticeContext {
    // Initialize devtools if not already done
    initializeDevTools(options);

    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const contextName = options.name || 'LatticeContext';

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

    return {
      signal<T>(initialValue: T, name?: string): Signal<T> {
        const signal = context.signal(initialValue);
        const signalId =
          name ?? `sig_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Emit signal creation
        emitEvent({
          type: 'SIGNAL_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: signalId,
            initialValue,
          },
        });

        // Instrument the signal's value setter
        // The descriptor is on the prototype, not the instance
        const prototypeDescriptor = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(signal),
          'value'
        );
        if (prototypeDescriptor?.set) {
          const originalSet = prototypeDescriptor.set;
          const originalGet = prototypeDescriptor.get;

          // Override on the instance to intercept
          Object.defineProperty(signal, 'value', {
            get() {
              const value = originalGet!.call(this);

              // Track reads if enabled
              if (options.trackReads) {
                emitEvent({
                  type: 'SIGNAL_READ',
                  contextId,
                  timestamp: Date.now(),
                  data: {
                    id: signalId,
                    value,
                    executionContext: getCurrentExecutionContext(),
                  },
                });
              }

              return value;
            },
            set(newValue: T) {
              const oldValue = originalGet!.call(this);

              // Call original setter first
              const result = originalSet.call(this, newValue);

              // Emit write event after successful update
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

              return result;
            },
            enumerable: prototypeDescriptor.enumerable,
            configurable: true,
          });
        }

        // Note: We don't track peek() calls as they're meant for non-reactive reads

        return signal as Signal<T>;
      },

      computed<T>(fn: () => T): Computed<T> {
        const computedId = `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Wrap the compute function to track execution
        const wrappedFn = options.trackComputations
          ? function (this: unknown) {
              const startTime = performance.now();
              const prevContext = getCurrentExecutionContext();
              setCurrentExecutionContext(computedId);

              emitEvent({
                type: 'COMPUTED_START',
                contextId,
                timestamp: Date.now(),
                data: {
                  id: computedId,
                },
              });

              try {
                const result = fn.call(this);

                emitEvent({
                  type: 'COMPUTED_END',
                  contextId,
                  timestamp: Date.now(),
                  data: {
                    id: computedId,
                    duration: performance.now() - startTime,
                    value: result,
                  },
                });

                return result;
              } finally {
                setCurrentExecutionContext(prevContext);
              }
            }
          : fn;

        const computed = context.computed(wrappedFn);

        // Emit computed creation
        emitEvent({
          type: 'COMPUTED_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: computedId,
          },
        });

        return computed as Computed<T>;
      },

      effect(fn: () => void | (() => void)): () => void {
        const effectId = `eff_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Wrap the effect function to track execution
        const wrappedFn = function (this: unknown) {
          const startTime = performance.now();
          const prevContext = getCurrentExecutionContext();
          setCurrentExecutionContext(effectId);

          emitEvent({
            type: 'EFFECT_START',
            contextId,
            timestamp: Date.now(),
            data: {
              id: effectId,
            },
          });

          try {
            const cleanup = fn.call(this);

            emitEvent({
              type: 'EFFECT_END',
              contextId,
              timestamp: Date.now(),
              data: {
                id: effectId,
                duration: performance.now() - startTime,
                hasCleanup: typeof cleanup === 'function',
              },
            });

            return cleanup;
          } finally {
            setCurrentExecutionContext(prevContext);
          }
        };

        // Create the effect
        const dispose = context.effect(wrappedFn);

        // Emit effect creation
        emitEvent({
          type: 'EFFECT_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: effectId,
          },
        });

        // Wrap the disposer to track cleanup
        return () => {
          dispose();

          emitEvent({
            type: 'EFFECT_DISPOSED',
            contextId,
            timestamp: Date.now(),
            data: {
              id: effectId,
            },
          });
        };
      },

      batch(fn: () => void): void {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        emitEvent({
          type: 'BATCH_START',
          contextId,
          timestamp: Date.now(),
          data: {
            id: batchId,
          },
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
        // Emit context disposal
        emitEvent({
          type: 'CONTEXT_DISPOSED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: contextId,
            name: contextName,
          },
        });

        // Dispose the original context
        context.dispose();
      },
    };
  };
}
