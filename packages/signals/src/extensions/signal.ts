/**
 * Signal extension for lattice
 */
import type { LatticeExtension } from '@lattice/lattice';
import { signal as signalImpl } from '../api';
import type { Signal } from '../types';

export const signalExtension: LatticeExtension<
  'signal',
  <T>(initialValue: T, name?: string) => Signal<T>
> = {
  name: 'signal',
  method: signalImpl as <T>(initialValue: T, name?: string) => Signal<T>,
  
  wrap(signalFn, ctx) {
    // Return a function that accepts name parameter but ignores it
    const wrappedFn = function <T>(initialValue: T): Signal<T> {
      if (ctx.isDisposed) {
        throw new Error('Cannot create signal in disposed context');
      }
      
      // signalImpl doesn't accept name, so we ignore it
      return signalFn(initialValue);
    };
    
    // Cast to include the optional name parameter in the signature
    return wrappedFn as typeof signalFn;
  },
  
  instrument(signalFn, instrumentation) {
    return function <T>(initialValue: T, name?: string): Signal<T> {
      const signal = signalFn(initialValue, name);
      
      // Register the signal for tracking
      const { id } = instrumentation.register(signal, 'signal', name);
      
      // Emit creation event
      instrumentation.emit({
        type: 'SIGNAL_CREATED',
        timestamp: Date.now(),
        data: {
          id,
          name,
          initialValue,
          contextId: instrumentation.contextId,
        },
      });
      
      // Instrument value getter/setter
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
            
            // Emit read event
            instrumentation.emit({
              type: 'SIGNAL_READ',
              timestamp: Date.now(),
              data: {
                id,
                name,
                value,
                contextId: instrumentation.contextId,
              },
            });
            
            return value;
          },

          set(newValue: T) {
            const oldValue = originalGet() as T;
            const result = originalSet(newValue);

            // Emit write event
            instrumentation.emit({
              type: 'SIGNAL_WRITE',
              timestamp: Date.now(),
              data: {
                id,
                name,
                oldValue,
                newValue,
                contextId: instrumentation.contextId,
              },
            });

            return result;
          },

          enumerable: descriptor.enumerable,
          configurable: true,
        });
      }
      
      return signal;
    };
  }
};