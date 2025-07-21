import type { DependencyNode } from './types';
import type { Effect as EffectInterface } from './types';
import { OUTDATED, RUNNING, DISPOSED, NOTIFIED } from './types';
import { activeContext } from './signal';
import { releaseNode } from './node-pool';
import type { EffectDisposer } from './types';
import { removeFromTargets } from './computed';

// Direct class syntax - cleaner and more idiomatic
class Effect implements EffectInterface {
  __type = 'effect' as const;
  _fn: () => void;
  _flags = OUTDATED;
  _sources: DependencyNode | undefined = undefined;
  _nextBatchedEffect: EffectInterface | undefined = undefined;

  constructor(fn: () => void) {
    this._fn = fn;
  }

  // Notify method - now uses global batch state
  _notify(): void {
    if (this._flags & NOTIFIED) return;
    this._flags |= NOTIFIED | OUTDATED;

    if (activeContext.batchDepth > 0) {
      // Add to batch queue
      this._nextBatchedEffect = activeContext.batchedEffects || undefined;
      activeContext.batchedEffects = this;
      return;
    }

    // Run immediately if not in batch
    activeContext.batchDepth++;
    try {
      this._run();
    } finally {
      if (--activeContext.batchDepth === 0) {
        // Run any effects that were queued during this run
        let effect = activeContext.batchedEffects;
        if (effect) {
          activeContext.batchedEffects = null;
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

  // Run method
  _run(): void {
    if (this._flags & (DISPOSED | RUNNING)) return;

    this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

    // Mark sources for cleanup
    markSourcesUnused(this);

    const prevComputed = activeContext.currentComputed;
    activeContext.currentComputed = this;

    try {
      this._fn();
    } finally {
      activeContext.currentComputed = prevComputed;
      this._flags &= ~RUNNING;

      // Cleanup unused sources
      cleanupUnusedSources(this);
    }
  }

  // Dispose method
  dispose(): void {
    if (!(this._flags & DISPOSED)) {
      this._flags |= DISPOSED;

      // Clear all sources
      disposeAllSources(this);
    }
  }
}

// Direct export instead of factory pattern
export function effect(effectFn: () => void | (() => void)): EffectDisposer {
  let cleanupFn: (() => void) | void;

  const e = new Effect(() => {
    // Run previous cleanup if exists
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
    }

    // Run effect and capture new cleanup
    cleanupFn = effectFn();
  });

  // Run immediately
  e._run();

  // Create dispose function
  const dispose = (() => {
    e.dispose();
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
    }
  }) as EffectDisposer;
  
  // Attach the Effect instance to the dispose function
  dispose.__effect = e;
  
  return dispose;
}

// Export Effect constructor for external use
export { Effect };

// Helper: Mark all sources as potentially unused before re-evaluation
function markSourcesUnused(effect: Effect): void {
  let node = effect._sources;
  while (node) {
    node.version = -1;
    node = node.nextSource;
  }
}

// Helper: Clean up sources that weren't used during re-evaluation
function cleanupUnusedSources(effect: Effect): void {
  let node = effect._sources;
  let prev: DependencyNode | undefined;

  while (node) {
    const next = node.nextSource;

    if (node.version === -1) {
      // Remove from sources list
      if (prev) {
        prev.nextSource = next;
      } else {
        effect._sources = next;
      }
      if (next) {
        next.prevSource = prev;
      }

      // Remove from source's targets and return to pool
      removeFromTargets(node);
      releaseNode(node);
    } else {
      prev = node;
    }

    node = next;
  }
}

// Helper: Dispose all source connections
function disposeAllSources(effect: Effect): void {
  let node = effect._sources;
  while (node) {
    const next = node.nextSource;
    removeFromTargets(node);
    releaseNode(node);
    node = next;
  }
  effect._sources = undefined;
}
