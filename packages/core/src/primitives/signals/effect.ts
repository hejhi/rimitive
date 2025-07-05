// Simplified Effect implementation - bare metal

import type { Effect, DependencyNode } from './types';
import { OUTDATED, RUNNING, DISPOSED, NOTIFIED } from './types';
import type { UnifiedScope } from './scope';

// Effect constructor
function EffectImpl(this: Effect, fn: () => void) {
  this._fn = fn;
  this._flags = OUTDATED;
  this._sources = undefined;
  this._nextBatchedEffect = undefined;
  this._scope = undefined;
}

// Cast to constructor type
const Effect = EffectImpl as unknown as {
  new (fn: () => void): Effect;
  prototype: Effect;
};

// Notify method
Effect.prototype._notify = function(): void {
  if (!(this._flags & NOTIFIED)) {
    this._flags |= NOTIFIED | OUTDATED;
    
    const scope = this._scope as UnifiedScope;
    if (scope.batchDepth > 0) {
      this._nextBatchedEffect = scope.batchedEffects || undefined;
      scope.batchedEffects = this;
    } else {
      // Run immediately if not in batch
      scope.batchDepth++;
      try {
        this._run();
      } finally {
        scope.batchDepth--;
        // Run any effects that were queued during this run
        if (scope.batchDepth === 0 && scope.batchedEffects) {
          let effect = scope.batchedEffects;
          scope.batchedEffects = null;
          while (effect) {
            const next = effect._nextBatchedEffect;
            effect._nextBatchedEffect = undefined;
            effect._run();
            effect = next!;
          }
        }
      }
    }
  }
};

// Run method
Effect.prototype._run = function(): void {
  if (this._flags & (DISPOSED | RUNNING)) return;

  this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

  // Mark sources for cleanup
  let node = this._sources;
  while (node) {
    node.version = -1;
    node = node.nextSource;
  }

  const scope = this._scope as UnifiedScope;
  const prevComputed = scope.currentComputed;
  scope.currentComputed = this;

  try {
    this._fn();
  } finally {
    scope.currentComputed = prevComputed;
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
      } else {
        prev = node;
      }

      node = next;
    }
  }
};

// Dispose method
Effect.prototype.dispose = function(): void {
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

      node = next;
    }
    
    this._sources = undefined;
  }
};

// Placeholder subscribe
Effect.prototype.subscribe = function() {
  return () => {};
};

export type EffectScope = {
  effect: (fn: () => void) => () => void;
};

export function createEffectScope(scope: UnifiedScope): EffectScope {
  function effect(fn: () => void): () => void {
    const e = new Effect(fn);
    e._scope = scope;
    
    // Run immediately
    e._run();

    // Return dispose function
    return () => e.dispose();
  }

  return { effect };
}