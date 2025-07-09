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

/**
 * Creates a devtools middleware that instruments a Lattice context
 */
export function withDevTools(options: DevToolsOptions = {}) {
  return function instrumentContext(context: LatticeContext): LatticeContext {
    // Initialize devtools if not already done
    initializeDevTools(options);

    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const contextName = options.name || 'LatticeContext';

    // Track created primitives for cleanup
    const signalIds = new WeakMap<any, string>();
    const computedIds = new WeakMap<any, string>();
    const effectIds = new Set<string>();

    // Emit context creation
    emitEvent({
      type: 'CONTEXT_CREATED',
      contextId,
      timestamp: Date.now(),
      data: {
        id: contextId,
        name: contextName,
      }
    });

    return {
      signal<T>(initialValue: T): Signal<T> {
        const signal = context.signal(initialValue);
        const signalId = `sig_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        signalIds.set(signal, signalId);

        // Emit signal creation
        emitEvent({
          type: 'SIGNAL_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: signalId,
            initialValue,
          }
        });

        // Instrument the signal's value setter
        const descriptor = Object.getOwnPropertyDescriptor(signal, 'value');
        if (descriptor?.set) {
          const originalSet = descriptor.set;
          Object.defineProperty(signal, 'value', {
            get: descriptor.get,
            set(newValue: T) {
              const oldValue = descriptor.get!.call(this);
              
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
                }
              });
              
              return result;
            },
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
          });
        }

        // Track reads if we're in a tracking context
        const originalPeek = signal.peek;
        signal.peek = function() {
          const value = originalPeek.call(this);
          
          // Emit read event for debugging
          if (options.trackReads) {
            emitEvent({
              type: 'SIGNAL_READ',
              contextId,
              timestamp: Date.now(),
              data: {
                id: signalId,
                value,
              }
            });
          }
          
          return value;
        };

        return signal as Signal<T>;
      },

      computed<T>(fn: () => T): Computed<T> {
        const computedId = `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        // Wrap the compute function to track execution
        const wrappedFn = options.trackComputations 
          ? function(this: unknown) {
              const startTime = performance.now();
              
              emitEvent({
                type: 'COMPUTED_START',
                contextId,
                timestamp: Date.now(),
                data: {
                  id: computedId,
                }
              });
              
              const result = fn.call(this);
              
              emitEvent({
                type: 'COMPUTED_END',
                contextId,
                timestamp: Date.now(),
                data: {
                  id: computedId,
                  duration: performance.now() - startTime,
                  value: result,
                }
              });
              
              return result;
            }
          : fn;

        const computed = context.computed(wrappedFn);
        computedIds.set(computed, computedId);

        // Emit computed creation
        emitEvent({
          type: 'COMPUTED_CREATED',
          contextId,
          timestamp: Date.now(),
          data: {
            id: computedId,
          }
        });

        return computed as Computed<T>;
      },

      effect(fn: () => void | (() => void)): () => void {
        const effectId = `eff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        effectIds.add(effectId);

        // Wrap the effect function to track execution
        const wrappedFn = function(this: unknown) {
          const startTime = performance.now();
          
          emitEvent({
            type: 'EFFECT_START',
            contextId,
            timestamp: Date.now(),
            data: {
              id: effectId,
            }
          });
          
          const cleanup = fn.call(this);
          
          emitEvent({
            type: 'EFFECT_END',
            contextId,
            timestamp: Date.now(),
            data: {
              id: effectId,
              duration: performance.now() - startTime,
              hasCleanup: typeof cleanup === 'function',
            }
          });
          
          return cleanup;
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
          }
        });

        // Wrap the disposer to track cleanup
        return () => {
          dispose();
          effectIds.delete(effectId);
          
          emitEvent({
            type: 'EFFECT_DISPOSED',
            contextId,
            timestamp: Date.now(),
            data: {
              id: effectId,
            }
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
          }
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
            }
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
            }
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
          }
        });
        
        // Clear our tracking
        effectIds.clear();
        
        // Dispose the original context
        context.dispose();
      }
    };
  };
}