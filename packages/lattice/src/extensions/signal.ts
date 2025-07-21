/**
 * Signal extension for lattice
 */
import type { LatticeExtension } from '../extension';
import { signal as signalImpl } from '@lattice/signals/signal';
import type { Signal } from '@lattice/signals';

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
      const sig = signalFn(initialValue);
      
      // Track the signal for debugging
      return ctx.track(sig, 'signal');
    };
    
    // Cast to include the optional name parameter in the signature
    return wrappedFn as typeof signalFn;
  }
};