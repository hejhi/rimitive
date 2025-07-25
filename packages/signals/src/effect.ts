// Effect implementation with factory pattern for performance
import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { DependencyNode, Effect as EffectInterface, EffectDisposer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { SourceCleaner, NodePoolManager } from './shared-helpers';

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
} = CONSTANTS;

export function createEffectFactory(ctx: SignalContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const pool = new NodePoolManager(ctx);
  const cleaner = new SourceCleaner(pool);
  
  class Effect implements EffectInterface {
    __type = 'effect' as const;
    _fn: () => void;
    _flags = OUTDATED;
    _sources: DependencyNode | undefined = undefined;
    _nextBatchedEffect: EffectInterface | undefined = undefined;

    constructor(fn: () => void) {
      this._fn = fn;
    }

    _notify(): void {
      if (this._flags & NOTIFIED) return;
      this._flags |= NOTIFIED | OUTDATED;

      if (ctx.batchDepth > 0) {
        this._nextBatchedEffect = ctx.batchedEffects || undefined;
        ctx.batchedEffects = this;
        return;
      }

      ctx.batchDepth++;
      try {
        this._run();
      } finally {
        if (--ctx.batchDepth === 0) {
          // Process batched effects
          let effect = ctx.batchedEffects;
          if (effect) {
            ctx.batchedEffects = null;
            while (effect) {
              const next: EffectInterface | undefined = effect._nextBatchedEffect;
              effect._nextBatchedEffect = undefined;
              effect._run();
              effect = next!;
            }
          }
          
          // Process batched subscribes
          if (ctx.subscribeBatch && ctx.subscribeBatch.size > 0) {
            const batch = ctx.subscribeBatch;
            ctx.subscribeBatch = undefined;
            for (const subscribe of batch) {
              subscribe._execute();
            }
          }
        }
      }
    }

    _run(): void {
      if (this._flags & (DISPOSED | RUNNING)) return;

      this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Mark sources for cleanup
      let node = this._sources;
      while (node) {
        node.version = -1;
        node = node.nextSource;
      }

      const prevComputed = ctx.currentComputed;
      ctx.currentComputed = this;

      try {
        this._fn();
      } finally {
        ctx.currentComputed = prevComputed;
        this._flags &= ~RUNNING;

        // Cleanup unused sources
        cleaner.cleanupSources(this);
      }
    }

    dispose(): void {
      if (!(this._flags & DISPOSED)) {
        this._flags |= DISPOSED;
        cleaner.disposeAllSources(this);
      }
    }
  }

  return {
    name: 'effect',
    method: function effect(effectFn: () => void | (() => void)): EffectDisposer {
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
  };
}