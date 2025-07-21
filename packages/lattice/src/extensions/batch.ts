/**
 * Batch extension for lattice
 */
import type { LatticeExtension } from '../extension';
import { batch as batchImpl } from '@lattice/signals/batch';

export const batchExtension: LatticeExtension<
  'batch',
  <T>(fn: () => T) => T
> = {
  name: 'batch',
  method: batchImpl,
  
  // No wrapping needed - batch doesn't need disposal tracking
  // But we could add disposed check if desired
  wrap(batchFn, ctx) {
    return <T>(fn: () => T): T => {
      if (ctx.isDisposed) {
        throw new Error('Cannot use batch in disposed context');
      }
      return batchFn(fn);
    };
  }
};