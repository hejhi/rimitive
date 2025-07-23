/**
 * Subscribe extension for lattice
 */
import type { LatticeExtension } from '@lattice/lattice';
import { subscribe as subscribeImpl } from '../';
import type { Signal, Computed, Selected, Unsubscribe } from '../types';

export const subscribeExtension: LatticeExtension<
  'subscribe',
  (source: Signal<unknown> | Computed<unknown> | Selected<unknown>, callback: () => void) => Unsubscribe
> = {
  name: 'subscribe',
  method: subscribeImpl,
  
  wrap(subscribeFn, ctx) {
    return (
      source: Signal<unknown> | Computed<unknown> | Selected<unknown>,
      callback: () => void
    ): Unsubscribe => {
      if (ctx.isDisposed) {
        throw new Error('Cannot use subscribe in disposed context');
      }
      
      const unsubscribe = subscribeFn(source, callback);
      
      // Track the subscription
      ctx.onDispose(unsubscribe);
      
      // Return wrapped unsubscribe that could remove from tracking
      // (though disposal will clear all anyway)
      return unsubscribe;
    };
  }
};