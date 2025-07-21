/**
 * Computed extension for lattice
 */
import type { LatticeExtension } from '../extension';
import { computed as computedImpl } from '@lattice/signals/computed';
import type { Computed } from '@lattice/signals';

export const computedExtension: LatticeExtension<
  'computed',
  <T>(computeFn: () => T) => Computed<T>
> = {
  name: 'computed',
  method: computedImpl,
  
  wrap(computedFn, ctx) {
    return <T>(fn: () => T): Computed<T> => {
      if (ctx.isDisposed) {
        throw new Error('Cannot create computed in disposed context');
      }
      
      const comp = computedFn(fn);
      
      // Track the computed
      ctx.track(comp, 'computed');
      
      // Register cleanup - computeds need to be disposed
      ctx.onDispose(() => comp.dispose());
      
      return comp;
    };
  }
};