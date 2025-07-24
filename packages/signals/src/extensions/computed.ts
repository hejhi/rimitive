/**
 * Computed extension for lattice
 */
import type { LatticeExtension } from '@lattice/lattice';
import { createComputedFactory } from '../computed';
import { createSignalAPI } from '../api';
import type { Computed } from '../types';

// Create a default API instance for the extension
const defaultAPI = createSignalAPI({ computed: createComputedFactory });

export const computedExtension: LatticeExtension<
  'computed',
  <T>(computeFn: () => T, name?: string) => Computed<T>
> = {
  name: 'computed',
  method: defaultAPI.computed as <T>(computeFn: () => T, name?: string) => Computed<T>,
  
  wrap(computedFn, ctx) {
    return <T>(fn: () => T, name?: string): Computed<T> => {
      if (ctx.isDisposed) {
        throw new Error('Cannot create computed in disposed context');
      }
      
      const comp = computedFn(fn, name);
      
      // Register cleanup - computeds need to be disposed
      ctx.onDispose(() => comp.dispose());
      
      return comp;
    };
  },
  
  instrument(computedFn, instrumentation) {
    return function <T>(fn: () => T, name?: string): Computed<T> {
      const computed = computedFn(fn, name);
      
      // Register the computed for tracking
      const { id } = instrumentation.register(computed, 'computed', name);
      
      // Emit creation event
      instrumentation.emit({
        type: 'COMPUTED_CREATED',
        timestamp: Date.now(),
        data: {
          id,
          name,
          contextId: instrumentation.contextId,
        },
      });
      
      // Instrument value getter
      const proto = Object.getPrototypeOf(computed) as object | null;
      const descriptor = proto
        ? Object.getOwnPropertyDescriptor(proto, 'value')
        : undefined;

      if (descriptor?.get) {
        const originalGet = descriptor.get.bind(computed);

        Object.defineProperty(computed, 'value', {
          get() {
            // Emit computation start
            instrumentation.emit({
              type: 'COMPUTE_START',
              timestamp: Date.now(),
              data: {
                id,
                name,
                contextId: instrumentation.contextId,
              },
            });
            
            const startTime = performance.now();
            const value = originalGet() as T;
            const duration = performance.now() - startTime;
            
            // Emit computation end
            instrumentation.emit({
              type: 'COMPUTE_END',
              timestamp: Date.now(),
              data: {
                id,
                name,
                value,
                duration,
                contextId: instrumentation.contextId,
              },
            });
            
            return value;
          },

          enumerable: descriptor.enumerable,
          configurable: true,
        });
      }
      
      return computed;
    };
  }
};