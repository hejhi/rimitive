/**
 * Effect extension for lattice
 */
import type { LatticeExtension } from '../extension';
import { effect as effectImpl } from '@lattice/signals/effect';
import type { EffectDisposer } from '@lattice/signals';

export const effectExtension: LatticeExtension<
  'effect',
  (effectFn: () => void | (() => void)) => EffectDisposer
> = {
  name: 'effect',
  method: effectImpl,
  
  wrap(effectFn, ctx) {
    return (fn: () => void | (() => void)): EffectDisposer => {
      if (ctx.isDisposed) {
        throw new Error('Cannot create effect in disposed context');
      }
      
      const disposer = effectFn(fn);
      
      // Register the disposer for cleanup
      ctx.onDispose(disposer);
      
      // Return wrapped disposer that also removes from tracking
      const wrappedDisposer = (() => {
        disposer();
        // Note: We can't remove from disposers set here as we don't have access
        // This is fine - disposal will clear all anyway
      }) as EffectDisposer;
      
      // Copy over the effect reference
      wrappedDisposer.__effect = disposer.__effect;
      
      return wrappedDisposer;
    };
  }
};