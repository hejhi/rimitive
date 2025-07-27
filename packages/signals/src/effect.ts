import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, ScheduledConsumer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers } from './helpers/node-pool';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';

export interface EffectInterface extends ScheduledConsumer {
  __type: 'effect';
  _fn(): void;
  dispose(): void;
  subscribe?: (listener: () => void) => () => void;
}

export type EffectCleanup = void | (() => void);
export type Unsubscribe = () => void;

// Dispose function with attached effect instance
export interface EffectDisposer {
  (): void;
  __effect: EffectInterface;
}


const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
} = CONSTANTS;

export function createEffectFactory(ctx: SignalContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const pool = createNodePoolHelpers(ctx);
  const { disposeAllSources, cleanupSources } = createSourceCleanupHelpers(pool);
  
  class Effect implements EffectInterface {
    __type = 'effect' as const;
    _fn: () => void;

    _sources: Edge | undefined = undefined;
    _flags = OUTDATED;

    _nextScheduled: ScheduledConsumer | undefined = undefined;

    constructor(fn: () => void) {
      this._fn = fn;
    }

    _invalidate(): void {
      if (this._flags & NOTIFIED) return;
      this._flags |= NOTIFIED | OUTDATED;

      if (ctx.batchDepth > 0) {
        this._nextScheduled = ctx.scheduled || undefined;
        ctx.scheduled = this;
        return;
      }

      this._flush();
    }

    _flush(): void {
      if (this._flags & (DISPOSED | RUNNING)) return;

      this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Mark sources for cleanup
      let node = this._sources;
      while (node) {
        node.version = -1;
        node = node.nextSource;
      }

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;

      try {
        this._fn();
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;

        // Cleanup unused sources
        cleanupSources(this);
      }
    }

    dispose(): void {
      if (!(this._flags & DISPOSED)) {
        this._flags |= DISPOSED;
        disposeAllSources(this);
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

      e._flush();

      let disposed = false;
      const dispose = (() => {
        if (disposed) return;
        disposed = true;
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