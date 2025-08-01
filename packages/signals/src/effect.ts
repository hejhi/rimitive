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

      // Check if we're actually dirty (push-pull: effects also check dependencies)
      if (flags & NOTIFIED && !(flags & OUTDATED)) {
        // Check if any source actually changed
        if (!this._checkDirty()) {
          this._flags &= ~NOTIFIED;
          return;
        }
        // Mark as outdated since we confirmed it's dirty
        this._flags |= OUTDATED;
      }

      this._flags = (flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Store and update context
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      // Track if we need cleanup
      let needsCleanup = false;

      try {
        // Mark sources
        let node = this._sources;
        while (node) {
          node.version = -1;
          needsCleanup = true;
          node = node.nextSource;
        }

        // Execute effect with minimal overhead
        // Fast path - no cleanup
        if (this._cleanup) {
          this._cleanup();
          this._cleanup = undefined;
        }
        
        const result = this._callback();
        // Only assign if function returned
        if (result) {
          this._cleanup = result;
        }
      } finally {
        // Restore context
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        
        // Only cleanup if we marked sources
        if (needsCleanup) {
          cleanupSources(this);
        }
      }
    }

    _checkDirty(): boolean {
      let source = this._sources;
      while (source) {
        const sourceNode = source.source;
        
        // Check if source is a computed that needs updating
        if ('_update' in sourceNode && '_flags' in sourceNode && typeof (sourceNode as unknown as {_update: unknown})._update === 'function') {
          const oldVersion = sourceNode._version;
          (sourceNode as unknown as {_update(): void})._update();
          if (oldVersion !== sourceNode._version) return true;
        } else if (source.version !== sourceNode._version) {
          // Signal changed
          return true;
        }
        
        source = source.nextSource;
      }
      return false;
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