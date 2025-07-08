// Simplified Effect implementation - bare metal

import type { Effect, DependencyNode } from './types';
import { OUTDATED, RUNNING, DISPOSED, NOTIFIED } from './types';
import { activeContext } from './signal';
import { releaseNode } from './node-pool';

// Effect constructor
function EffectImpl(this: Effect, fn: () => void) {
  this._fn = fn;
  this._flags = OUTDATED;
  this._sources = undefined;
  this._nextBatchedEffect = undefined;
}

// Cast to constructor type
const Effect = EffectImpl as unknown as {
  new (fn: () => void): Effect;
  prototype: Effect;
};

// Notify method - now uses global batch state
Effect.prototype._notify = function (): void {
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
          const next: Effect | undefined = effect._nextBatchedEffect;
          effect._nextBatchedEffect = undefined;
          effect._run();
          effect = next!;
        }
      }
    }
  }
};

// Run method
Effect.prototype._run = function (): void {
  if (this._flags & (DISPOSED | RUNNING)) return;

  this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

  // Mark sources for cleanup
  let node = this._sources;
  while (node) {
    node.version = -1;
    node = node.nextSource;
  }

  const prevComputed = activeContext.currentComputed;
  activeContext.currentComputed = this;

  try {
    this._fn();
  } finally {
    activeContext.currentComputed = prevComputed;
    this._flags &= ~RUNNING;

    // Cleanup unused sources
    let node = this._sources;
    let prev: DependencyNode | undefined;

    while (node) {
      const next = node.nextSource;

      if (node.version === -1) {
        // Remove unused
        if (prev) {
          prev.nextSource = next;
        } else {
          this._sources = next;
        }
        if (next) {
          next.prevSource = prev;
        }

        // Remove from source's targets
        const source = node.source;
        const prevTarget = node.prevTarget;
        const nextTarget = node.nextTarget;

        if (prevTarget) {
          prevTarget.nextTarget = nextTarget;
        } else {
          source._targets = nextTarget;
        }

        if (nextTarget) {
          nextTarget.prevTarget = prevTarget;
        }

        // Return node to pool
        releaseNode(node);
      } else {
        prev = node;
      }

      node = next;
    }
  }
};

// Dispose method
Effect.prototype.dispose = function (): void {
  if (!(this._flags & DISPOSED)) {
    this._flags |= DISPOSED;

    // Clear all sources
    let node = this._sources;
    while (node) {
      const next = node.nextSource;
      const source = node.source;
      const prevTarget = node.prevTarget;
      const nextTarget = node.nextTarget;

      if (prevTarget) {
        prevTarget.nextTarget = nextTarget;
      } else {
        source._targets = nextTarget;
      }

      if (nextTarget) {
        nextTarget.prevTarget = prevTarget;
      }

      // Return node to pool
      releaseNode(node);

      node = next;
    }

    this._sources = undefined;
  }
};

// Placeholder subscribe
Effect.prototype.subscribe = function () {
  return () => {};
};

// Direct export instead of factory pattern
export function effect(effectFn: () => void | (() => void)): () => void {
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

  // Return dispose function that also runs final cleanup
  return () => {
    e.dispose();
    if (cleanupFn && typeof cleanupFn === 'function') {
      cleanupFn();
    }
  };
}

// Export Effect constructor for external use
export { Effect };
