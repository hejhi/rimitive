import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Disposable, Edge, ScheduledNode, StatefulNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createDependencyHelpers } from './helpers/dependency-tracking';

export interface EffectInterface extends ScheduledNode, StatefulNode, Disposable {
  __type: 'effect';
  _callback(): void | (() => void);
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
  const { disposeAllSources, cleanupSources } =
    createSourceCleanupHelpers(createDependencyHelpers());
  
  class Effect implements EffectInterface {
    __type = 'effect' as const;
    _callback: () => void | (() => void);
    _cleanup: (() => void) | undefined = undefined;

    _sources: Edge | undefined = undefined;
    _flags = OUTDATED;

    _nextScheduled: ScheduledNode | undefined = undefined;

    constructor(fn: () => void | (() => void)) {
      this._callback = fn;
    }

    _invalidate(): void {
      // Inline invalidateConsumer for performance
      if (this._flags & NOTIFIED) return;
      this._flags |= NOTIFIED | OUTDATED;

      if (ctx.batchDepth > 0) {
        // Inline scheduleConsumer
        if (this._nextScheduled === undefined) {
          this._nextScheduled = ctx.scheduled === null ? undefined : ctx.scheduled;
          ctx.scheduled = this;
        }
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
        // Run cleanup if exists
        if (this._cleanup) {
          this._cleanup();
          this._cleanup = undefined;
        }
        
        // Execute effect and capture potential cleanup
        const result = this._callback();
        if (typeof result === 'function') {
          this._cleanup = result;
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
    }


    dispose(): void {
      // Inline disposeConsumer for performance
      if (this._flags & DISPOSED) return;
      this._flags |= DISPOSED;
      
      // Run cleanup if exists
      if (this._cleanup) {
        this._cleanup();
        this._cleanup = undefined;
      }
      
      disposeAllSources(this);
    }
  }

  return {
    name: 'effect',
    method: function effect(effectFn: () => void | (() => void)): EffectDisposer {
      const e = new Effect(effectFn);

      e._flush();

      const dispose = (() => {
        if (e._flags & DISPOSED) return;
        e.dispose();
      }) as EffectDisposer;

      dispose.__effect = e;

      return dispose;
    }
  };
}