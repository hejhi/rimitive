// Simplified Effect implementation - bare metal

import type { Effect, DependencyNode } from './types';
import { OUTDATED, RUNNING, DISPOSED, NOTIFIED } from './types';
import {
  setGlobalCurrentComputed,
  getGlobalCurrentComputed,
  isInBatch,
  startGlobalBatch,
  endGlobalBatch,
  addEffectToBatch,
  getGlobalBatchedEffects,
  setGlobalBatchedEffects,
} from './signal';
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

  if (isInBatch()) {
    // Add to global batch queue
    addEffectToBatch(this);
    return;
  }

  // Run immediately if not in batch
  startGlobalBatch();
  try {
    this._run();
  } finally {
    // endGlobalBatch returns true if batch depth reaches 0
    if (!endGlobalBatch()) {
      // Run any effects that were queued during this run
      let effect = getGlobalBatchedEffects();
      if (effect) {
        setGlobalBatchedEffects(null);
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

  const prevComputed = getGlobalCurrentComputed();
  setGlobalCurrentComputed(this);

  try {
    this._fn();
  } finally {
    setGlobalCurrentComputed(prevComputed);
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

export type EffectScope = {
  effect: (fn: () => void) => () => void;
};

export function createEffectScope(): EffectScope {
  function effect(fn: () => void): () => void {
    const e = new Effect(fn);

    // Run immediately
    e._run();

    // Return dispose function
    return () => e.dispose();
  }

  return { effect };
}
