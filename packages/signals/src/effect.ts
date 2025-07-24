// Effect implementation with factory pattern for performance
import type { SignalContext } from './context';
import { RUNNING, DISPOSED, OUTDATED, NOTIFIED, MAX_POOL_SIZE, removeFromTargets } from './context';
import { DependencyNode, Effect as EffectInterface, EffectDisposer } from './types';

export function createEffectFactory(ctx: SignalContext) {
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

            removeFromTargets(node);
            
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
          removeFromTargets(node);
          
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

  return function effect(effectFn: () => void | (() => void)): EffectDisposer {
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
}