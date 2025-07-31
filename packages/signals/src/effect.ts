import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Disposable, Edge, ScheduledNode, StatefulNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createDependencyHelpers } from './helpers/dependency-tracking';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

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

// Pre-created generic dispose function to avoid creating new bound functions for each effect
const genericDispose = function(this: EffectInterface) { 
  this.dispose(); 
};

export function createEffectFactory(ctx: SignalContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const { disposeAllSources, cleanupSources } =
    createSourceCleanupHelpers(createDependencyHelpers());
  const { invalidateConsumer, disposeConsumer } = createScheduledConsumerHelpers(ctx);
  class Effect implements EffectInterface {
    // Hot fields together (accessed frequently in _flush and scheduling)
    _flags = OUTDATED;
    _sources: Edge | undefined = undefined;
    _nextScheduled: ScheduledNode | undefined = undefined;
    
    // Cold fields (less frequently accessed)
    __type = 'effect' as const;
    _callback: () => void | (() => void);
    _cleanup: (() => void) | undefined = undefined;

    constructor(fn: () => void | (() => void)) {
      this._callback = fn;
    }

    _invalidate(): void {
      invalidateConsumer(this, NOTIFIED, NOTIFIED | OUTDATED);
    }

    _flush(): void {
      // Fast path checks combined
      const flags = this._flags;
      if (flags & (DISPOSED | RUNNING)) return;

      this._flags = (flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Mark sources
      let node = this._sources;
      while (node) {
        node.version = -1;
        node = node.nextSource;
      }

      // Store and update context
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;

      try {
        // Execute effect with minimal overhead
        const cleanup = this._cleanup;
        if (cleanup) {
          cleanup();
          this._cleanup = undefined;
        }
        
        const result = this._callback();
        if (typeof result === 'function') {
          this._cleanup = result;
        }
      } finally {
        // Restore context
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        
        // Inline source cleanup for hot path
        cleanupSources(this);
      }
    }


    dispose(): void {
      disposeConsumer(this, () => {
        if (!this._cleanup) return;
        this._cleanup();
        this._cleanup = undefined;
      })
      
      disposeAllSources(this);
    }
  }

  return {
    name: 'effect',
    method: function effect(effectFn: () => void | (() => void)): EffectDisposer {
      const e = new Effect(effectFn);
      
      try {
        e._flush();
      } catch (error) {
        // Effect is still set up and reactive even if initial run throws
        throw error;
      }

      // Use pre-bound generic dispose to avoid new function allocation
      const dispose = genericDispose.bind(e) as EffectDisposer;
      dispose.__effect = e;

      return dispose;
    }
  };
}