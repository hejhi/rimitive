// Effect implementation with factory pattern for performance
import type { SignalContext } from './context';
import { DependencyNode, Effect as EffectInterface, EffectDisposer } from './types';
import type { LatticeExtension } from '@lattice/lattice';

// Inline constants for hot path performance
const RUNNING = 1 << 2;
const DISPOSED = 1 << 3;
const OUTDATED = 1 << 1;
const NOTIFIED = 1 << 0;
const MAX_POOL_SIZE = 1000;

export function createEffectFactory(ctx: SignalContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
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
        node = this._sources;
        let prev: DependencyNode | undefined;

        while (node) {
          const next = node.nextSource;

          if (node.version === -1) {
            if (prev) {
              prev.nextSource = next;
            } else {
              this._sources = next;
            }
            if (next) {
              next.prevSource = prev;
            }

            // Inline removeFromTargets for performance
            const source = node.source;
            const prevTarget = node.prevTarget;
            const nextTarget = node.nextTarget;

            if (prevTarget !== undefined) {
              prevTarget.nextTarget = nextTarget;
            } else {
              source._targets = nextTarget;
              if (nextTarget === undefined && '_flags' in source && typeof source._flags === 'number') {
                source._flags &= ~(1 << 4); // TRACKING
              }
            }

            if (nextTarget !== undefined) {
              nextTarget.prevTarget = prevTarget;
            }
            
            // Inline releaseNode
            if (ctx.poolSize < MAX_POOL_SIZE) {
              node.source = undefined!;
              node.target = undefined!;
              node.version = 0;
              node.nextSource = undefined;
              node.prevSource = undefined;
              node.nextTarget = undefined;
              node.prevTarget = undefined;
              ctx.nodePool[ctx.poolSize++] = node;
            }
          } else {
            prev = node;
          }

          node = next;
        }
      }
    }

    dispose(): void {
      if (!(this._flags & DISPOSED)) {
        this._flags |= DISPOSED;

        let node = this._sources;
        while (node) {
          const next = node.nextSource;
          // Inline removeFromTargets for performance
          const source = node.source;
          const prevTarget = node.prevTarget;
          const nextTarget = node.nextTarget;

          if (prevTarget !== undefined) {
            prevTarget.nextTarget = nextTarget;
          } else {
            source._targets = nextTarget;
            if (nextTarget === undefined && '_flags' in source && typeof source._flags === 'number') {
              source._flags &= ~(1 << 4); // TRACKING
            }
          }

          if (nextTarget !== undefined) {
            nextTarget.prevTarget = prevTarget;
          }
          
          // Inline releaseNode
          if (ctx.poolSize < MAX_POOL_SIZE) {
            node.source = undefined!;
            node.target = undefined!;
            node.version = 0;
            node.nextSource = undefined;
            node.prevSource = undefined;
            node.nextTarget = undefined;
            node.prevTarget = undefined;
            ctx.nodePool[ctx.poolSize++] = node;
          }
          
          node = next;
        }
        this._sources = undefined;
      }
    }
  }

  const effect = function effect(effectFn: () => void | (() => void)): EffectDisposer {
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
  };

  return {
    name: 'effect',
    method: effect
  };
}