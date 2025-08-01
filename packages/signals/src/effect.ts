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
  const depHelpers = createDependencyHelpers();
  const { shouldNodeUpdate } = depHelpers;
  const { disposeAllSources, cleanupSources } =
    createSourceCleanupHelpers(depHelpers);
  const { invalidateConsumer, disposeConsumer } = createScheduledConsumerHelpers(ctx);
  class Effect implements EffectInterface {
    // Hot fields together (accessed frequently in _flush and scheduling)
    _flags = OUTDATED;
    _sources: Edge | undefined = undefined;
    _nextScheduled: ScheduledNode | undefined = undefined;
    _globalVersion = -1;
    
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
      // Fast path: check disposal and running state
      if (this._flags & (DISPOSED | RUNNING)) return;

      // Use shared update logic to determine if we should run
      if (!shouldNodeUpdate(this, ctx)) return;

      // Set RUNNING, clear NOTIFIED and OUTDATED
      this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Store and update context
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;

      try {
        // Mark sources for dependency tracking
        let source = this._sources;
        while (source) {
          source.version = -1;
          source = source.nextSource;
        }

        // Run cleanup if exists
        if (this._cleanup) {
          this._cleanup();
          this._cleanup = undefined;
        }
        
        // Execute effect callback
        const result = this._callback();
        if (result) {
          this._cleanup = result;
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
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
      
      // Run the effect for the first time
      e._flush();

      // Use pre-bound generic dispose to avoid new function allocation
      const dispose = genericDispose.bind(e) as EffectDisposer;
      dispose.__effect = e;

      return dispose;
    }
  };
}