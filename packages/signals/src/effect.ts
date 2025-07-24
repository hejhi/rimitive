// Effect implementation with factory pattern for performance
import type { SignalContext } from './context';
import { DependencyNode, Effect as EffectInterface, EffectDisposer } from './types';
import type { LatticeExtension } from '@lattice/lattice';

export function createEffectFactory(ctx: SignalContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  // Inline constants for hot path performance
  const RUNNING = 1 << 2;
  const DISPOSED = 1 << 3;
  const OUTDATED = 1 << 1;
  const NOTIFIED = 1 << 0;
  
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
        if (ctx.batchedEffects === null) {
          ctx.batchedEffects = this;
          this._nextBatchedEffect = undefined;
        } else {
          this._nextBatchedEffect = ctx.batchedEffects;
          ctx.batchedEffects = this;
        }
      } else {
        this._run();
      }
    }

    _run(): void {
      if (this._flags & DISPOSED) return;
      this._flags &= ~NOTIFIED;

      if (this._flags & RUNNING) {
        throw new Error('Cycle detected');
      }

      this._flags |= RUNNING;
      const prevComputed = ctx.currentComputed;
      try {
        this._cleanupSources();
        ctx.currentComputed = this;
        const cleanup = this._fn();
        if (typeof cleanup === 'function') {
          // Store cleanup function if needed
          // This would need to be added to the Effect interface
        }
      } finally {
        ctx.currentComputed = prevComputed;
        this._flags &= ~RUNNING;
      }
    }

    _refresh(): boolean {
      if (this._flags & RUNNING) {
        this._flags |= OUTDATED;
        return false;
      }
      if (this._flags & OUTDATED) {
        this._run();
      }
      return true;
    }

    dispose(): void {
      if (this._flags & DISPOSED) return;
      this._flags |= DISPOSED;
      this._cleanupSources();
    }

    _cleanupSources(): void {
      let node = this._sources;
      let prev: DependencyNode | undefined;

      while (node !== undefined) {
        const next = node.nextSource;

        if (node.version !== -1 && ctx.currentComputed === this) {
          // Keep the node if we're tracking
          node.version = -1;
          prev = node;
        } else {
          // Remove the node
          if (prev !== undefined) {
            prev.nextSource = next;
          } else {
            this._sources = next;
          }

          if (next !== undefined) {
            next.prevSource = prev;
          }

          ctx.removeFromTargets(node);
          ctx.releaseNode(node);
        }

        node = next;
      }

      if (ctx.currentComputed !== this) {
        // Full cleanup when not tracking
        let node = this._sources;
        while (node) {
          const next = node.nextSource;
          ctx.removeFromTargets(node);
          ctx.releaseNode(node);

          node = next;
        }
        this._sources = undefined;
      }
    }
  }

  return {
    name: 'effect',
    method: function effect(fn: () => void | (() => void)): EffectDisposer {
      const eff = new Effect(fn);
      if (ctx.batchDepth === 0) {
        eff._run();
      } else {
        eff._notify();
      }
      const disposer = (() => eff.dispose()) as EffectDisposer;
      disposer.__effect = eff;
      return disposer;
    }
  };
}