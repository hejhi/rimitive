import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createGraphTraversalHelpers } from './helpers/graph-traversal';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, EdgeCache, StatefulNode, Disposable {
  __type: 'computed';
  readonly value: T;
  _callback(): T;
  _value: T | undefined;
  _globalVersion: number;
  _recompute(): void;
  dispose(): void;
}

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
  IS_COMPUTED,
} = CONSTANTS;

export function createComputedFactory(ctx: SignalContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const depHelpers = createDependencyHelpers();
  const { addDependency } = depHelpers
  const { disposeAllSources, cleanupSources } =
    createSourceCleanupHelpers(depHelpers);
  const scheduledConsumerHelpers = createScheduledConsumerHelpers(ctx);
  const { traverseAndInvalidate } = createGraphTraversalHelpers(ctx, scheduledConsumerHelpers);
  
  class Computed<T> implements ComputedInterface<T> {
    __type = 'computed' as const;
    _callback: () => T;
    _value: T | undefined = undefined;
    _sources: Edge | undefined = undefined;
    _flags = OUTDATED | IS_COMPUTED;
    _targets: Edge | undefined = undefined;
    _lastEdge: Edge | undefined = undefined;
    _version = 0;
    _globalVersion = -1;

    constructor(compute: () => T) {
      this._callback = compute;
    }

    get value(): T {
      // Check for circular dependency
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Track dependency if we're in a computation context
      const consumer = ctx.currentConsumer;
      if (
        consumer
          && '_flags' in consumer
          && typeof consumer._flags === 'number'
          && consumer._flags & RUNNING
      ) {
        addDependency(this, consumer, this._version);
      }
      
      // Handle dirty checking and recomputation
      if (this._flags & OUTDATED) {
        this._recompute();
      } else if (this._flags & NOTIFIED) {
        // Check if sources are actually dirty
        if (this._checkDirty()) {
          // Sources changed, mark as outdated and recompute
          this._flags |= OUTDATED;
          this._recompute();
        } else {
          // Sources didn't change, just clear notified
          this._flags &= ~NOTIFIED;
        }
      }
      
      return this._value!;
    }

    peek(): T {
      this._updateIfNeeded();
      return this._value!;
    }

    _recompute(): boolean {
      // Fast path: if global version hasn't changed, nothing can have changed
      if (this._globalVersion === ctx.version) {
        this._flags &= ~(OUTDATED | NOTIFIED);
        return false;
      }
      
      // Note: We don't check sources here anymore because if we're in _recompute,
      // we've already determined we need to recompute (either OUTDATED was set,
      // or _checkDirty returned true)

      // Set running flag and clear outdated/notified
      this._flags = (this._flags | RUNNING) & ~(OUTDATED | NOTIFIED);
      
      // Mark sources for dependency tracking
      let source = this._sources;
      while (source) {
        source.version = -1;
        source = source.nextSource;
      }
      
      // Execute computation with dependency tracking
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      let valueChanged = false;
      try {
        const oldValue = this._value;
        const newValue = this._callback();
        
        // Update value if changed or first run
        if (newValue !== oldValue || this._version === 0) {
          this._value = newValue;
          this._version++;
          valueChanged = true;
        }
        
        // Update global version after computation
        this._globalVersion = ctx.version;
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
      
      // Return whether the value changed
      // The recursive dirty checking will handle propagation through return values
      return valueChanged;
    }

    _invalidate(): void {
      // Skip if already notified, disposed, or currently recomputing
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      // Mark as notified only - OUTDATED will be set lazily if actually dirty
      this._flags |= NOTIFIED;

      // Use iterative traversal instead of recursion
      if (this._targets) {
        traverseAndInvalidate(this._targets);
      }
    }

    _updateIfNeeded(): boolean {
      // If already clean, nothing to do
      if (!(this._flags & (OUTDATED | NOTIFIED))) {
        return false;
      }
      
      // If OUTDATED, must recompute
      if (this._flags & OUTDATED) {
        return this._recompute();
      }
      
      // If only NOTIFIED, check if actually dirty
      if (this._flags & NOTIFIED) {
        const isDirty = this._checkDirty();
        if (isDirty) {
          this._flags |= OUTDATED;
          return this._recompute();
        } else {
          this._flags &= ~NOTIFIED;
          return false;
        }
      }
      
      return false;
    }

    _checkDirty(): boolean {
      let source = this._sources;
      while (source) {
        const sourceNode = source.source;
        
        // Check if source is a computed
        if ('_flags' in sourceNode && typeof sourceNode._flags === 'number' && '_checkAndUpdate' in sourceNode) {
          const sourceComputed = sourceNode as Computed<any>;
          
          // Check and update the source, returns true if value changed
          if (sourceComputed._checkAndUpdate()) {
            return true;
          }
          
          // Update our edge version to match source
          source.version = sourceComputed._version;
        } else {
          // For signals, just check version
          if (source.version !== sourceNode._version) {
            return true;
          }
        }
        
        source = source.nextSource;
      }
      return false;
    }
    
    _checkAndUpdate(): boolean {
      // If already clean, no change
      if (!(this._flags & (OUTDATED | NOTIFIED))) {
        return false;
      }
      
      // If OUTDATED, must recompute
      if (this._flags & OUTDATED) {
        return this._recompute();
      }
      
      // If NOTIFIED, check if actually dirty
      if (this._flags & NOTIFIED) {
        if (this._checkDirty()) {
          this._flags |= OUTDATED;
          return this._recompute();
        } else {
          this._flags &= ~NOTIFIED;
          return false;
        }
      }
      
      return false;
    }


    dispose(): void {
      if (this._flags & DISPOSED) return;
      
      this._flags |= DISPOSED;
      disposeAllSources(this);
      this._value = undefined;
    }
  }

  return {
    name: 'computed',
    method: <T>(compute: () => T): ComputedInterface<T> => new Computed(compute)
  };
}
