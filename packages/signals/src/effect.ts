import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Disposable, Edge, ScheduledNode, StatefulNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';
import { createDependencyHelpers } from './helpers/dependency-tracking';

export interface EffectInterface extends ScheduledNode, StatefulNode, Disposable {
  __type: 'effect';
  _callback(): void;
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
  const { invalidateConsumer, disposeConsumer } = createScheduledConsumerHelpers(ctx);
  
  class Effect implements EffectInterface {
    __type = 'effect' as const;
    _callback: () => void;

    _sources: Edge | undefined = undefined;
    _flags = OUTDATED;

    _nextScheduled: ScheduledNode | undefined = undefined;

    constructor(fn: () => void) {
      this._callback = fn;
    }

    _invalidate(): void {
      invalidateConsumer(this, NOTIFIED, NOTIFIED | OUTDATED);
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
        this._callback();
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;

        // Cleanup unused sources
        cleanupSources(this);
      }
    }

    dispose(): void {
      disposeConsumer(this, disposeAllSources);
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