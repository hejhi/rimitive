// Example of how to use the optimized architecture in a modular way
// This shows how to split signal, computed, and effect into separate modules
// while maintaining the performance of single-file implementation

import type { SignalContext, ISignal, IComputed, IEffect, EffectDisposer } from './optimized-architecture';
import { 
  createContext, 
  createSignalClass, 
  createComputedClass,
  createEffectClass 
} from './optimized-architecture';

// ===== signal.module.ts =====
export function createSignalModule(ctx: SignalContext) {
  const Signal = createSignalClass(ctx);
  
  function signal<T>(value: T): ISignal<T> {
    return new Signal(value);
  }
  
  return { signal };
}

// ===== computed.module.ts =====
export function createComputedModule(ctx: SignalContext) {
  const Computed = createComputedClass(ctx);
  
  function computed<T>(compute: () => T): IComputed<T> {
    return new Computed(compute);
  }
  
  return { computed };
}

// ===== effect.module.ts =====
export function createEffectModule(ctx: SignalContext) {
  const Effect = createEffectClass(ctx);
  
  function effect(effectFn: () => void | (() => void)): EffectDisposer {
    let cleanupFn: (() => void) | void;

    const e = new Effect(() => {
      if (cleanupFn && typeof cleanupFn === 'function') {
        cleanupFn();
      }
      cleanupFn = effectFn();
    });

    e._run();

    const dispose = (() => {
      e.dispose();
      if (cleanupFn && typeof cleanupFn === 'function') {
        cleanupFn();
      }
    }) as EffectDisposer;

    dispose.__effect = e;

    return dispose;
  }
  
  function batch<T>(fn: () => T): T {
    if (ctx.batchDepth) return fn();

    ctx.batchDepth++;
    try {
      return fn();
    } finally {
      if (--ctx.batchDepth === 0) {
        let effect = ctx.batchedEffects;
        ctx.batchedEffects = null;
        while (effect) {
          const next: IEffect | null = effect._nextBatchedEffect || null;
          effect._nextBatchedEffect = undefined;
          effect._run();
          effect = next;
        }
      }
    }
  }
  
  function untrack<T>(fn: () => T): T {
    const prev = ctx.currentComputed;
    ctx.currentComputed = null;
    try {
      return fn();
    } finally {
      ctx.currentComputed = prev;
    }
  }
  
  return { effect, batch, untrack };
}

// ===== index.ts - Main entry point =====
function createSignalsImplementation() {
  const ctx = createContext();
  
  // Each module gets the same context
  const { signal } = createSignalModule(ctx);
  const { computed } = createComputedModule(ctx);
  const { effect, batch, untrack } = createEffectModule(ctx);
  
  return {
    signal,
    computed,
    effect,
    batch,
    untrack,
    _ctx: ctx, // For debugging
  };
}

// ===== Usage =====
// Default export for backward compatibility
const defaultSignals = createSignalsImplementation();
export const signal = defaultSignals.signal;
export const computed = defaultSignals.computed;
export const effect = defaultSignals.effect;
export const batch = defaultSignals.batch;
export const untrack = defaultSignals.untrack;

// Also export factory for creating isolated contexts
export { createSignalsImplementation as createSignals };

// ===== Performance notes =====
/*
1. The context is passed as a parameter, not accessed via import
   - This allows the JS engine to inline and optimize better
   - No module boundary crossing for hot paths

2. All hot-path code (like node acquisition) is inlined
   - No function calls for performance-critical operations
   
3. The factory pattern allows:
   - Multiple independent signal contexts
   - Better tree-shaking (only include what you use)
   - Easier testing with isolated contexts
   
4. For maximum performance in production:
   - Use a bundler that can inline the module functions
   - Consider using the single-file version for critical paths
   - Profile to ensure the modular version meets performance needs
*/