/**
 * Effect extension for lattice
 */
import type { LatticeExtension } from '../extension';
import { effect as effectImpl } from '@lattice/signals/effect';
import type { EffectDisposer } from '@lattice/signals';

export const effectExtension: LatticeExtension<
  'effect',
  (effectFn: () => void | (() => void), name?: string) => EffectDisposer
> = {
  name: 'effect',
  method: effectImpl as (effectFn: () => void | (() => void), name?: string) => EffectDisposer,
  
  wrap(effectFn, ctx) {
    return (fn: () => void | (() => void), name?: string): EffectDisposer => {
      if (ctx.isDisposed) {
        throw new Error('Cannot create effect in disposed context');
      }
      
      const disposer = effectFn(fn, name);
      
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
  },
  
  instrument(effectFn, instrumentation) {
    return function (fn: () => void | (() => void), name?: string): EffectDisposer {
      let effectId = '';
      
      // Wrap the effect function to track execution
      const instrumentedFn = () => {
        // Emit effect start
        instrumentation.emit({
          type: 'EFFECT_START',
          timestamp: Date.now(),
          data: {
            id: effectId,
            name,
            contextId: instrumentation.contextId,
          },
        });
        
        const startTime = performance.now();
        const cleanup = fn();
        const duration = performance.now() - startTime;
        
        // Emit effect end
        instrumentation.emit({
          type: 'EFFECT_END',
          timestamp: Date.now(),
          data: {
            id: effectId,
            name,
            duration,
            hasCleanup: typeof cleanup === 'function',
            contextId: instrumentation.contextId,
          },
        });
        
        return cleanup;
      };
      
      const disposer = effectFn(instrumentedFn, name);
      
      // Register the effect for tracking
      const registration = instrumentation.register(disposer.__effect, 'effect', name);
      effectId = registration.id;
      
      // Emit creation event
      instrumentation.emit({
        type: 'EFFECT_CREATED',
        timestamp: Date.now(),
        data: {
          id: effectId,
          name,
          contextId: instrumentation.contextId,
        },
      });
      
      // Wrap the disposer to emit disposal event
      const instrumentedDisposer = (() => {
        disposer();
        
        // Emit disposal event
        instrumentation.emit({
          type: 'EFFECT_DISPOSED',
          timestamp: Date.now(),
          data: {
            id: effectId,
            name,
            contextId: instrumentation.contextId,
          },
        });
      }) as EffectDisposer;
      
      // Copy over the effect reference
      instrumentedDisposer.__effect = disposer.__effect;
      
      return instrumentedDisposer;
    };
  }
};