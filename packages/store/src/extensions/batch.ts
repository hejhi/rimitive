/**
 * Batch extension for lattice
 */
import type { LatticeExtension } from '@lattice/lattice';
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
  },
  
  instrument(batchFn, instrumentation) {
    let batchCounter = 0;
    
    return function <T>(fn: () => T): T {
      const batchId = `batch_${++batchCounter}`;
      
      // Emit batch start
      instrumentation.emit({
        type: 'BATCH_START',
        timestamp: Date.now(),
        data: {
          id: batchId,
          contextId: instrumentation.contextId,
        },
      });
      
      const startTime = performance.now();
      let result: T;
      let error: unknown;
      
      try {
        result = batchFn(fn);
      } catch (e) {
        error = e;
      }
      
      const duration = performance.now() - startTime;
      
      // Emit batch end
      instrumentation.emit({
        type: 'BATCH_END',
        timestamp: Date.now(),
        data: {
          id: batchId,
          duration,
          success: !error,
          contextId: instrumentation.contextId,
        },
      });
      
      if (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(typeof error === 'string' ? error : 'Batch operation failed');
      }
      
      return result!;
    };
  }
};