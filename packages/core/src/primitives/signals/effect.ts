// Simplified Effect implementation - bare metal

import type { Effect, DependencyNode } from './types';
import { OUTDATED, RUNNING, DISPOSED, NOTIFIED } from './types';
import type { UnifiedScope } from './scope';

export type EffectScope = {
  effect: (fn: () => void) => () => void;
};

export function createEffectScope(scope: UnifiedScope): EffectScope {
  function effect(fn: () => void): () => void {
    // Create effect with minimal structure
    const e: Effect = {
      _fn: fn,
      _flags: OUTDATED,
      _sources: undefined,
      _nextBatchedEffect: undefined,
      _notify: (() => {}) as Effect['_notify'],
      _run: (() => {}) as Effect['_run'],
      dispose: (() => {}) as Effect['dispose'],
    };

    // Bind methods
    e._notify = function() {
      if (!(e._flags & NOTIFIED)) {
        e._flags |= NOTIFIED | OUTDATED;
        
        if (scope.batchDepth > 0) {
          e._nextBatchedEffect = scope.batchedEffects || undefined;
          scope.batchedEffects = e;
        } else {
          // Run immediately if not in batch
          scope.batchDepth++;
          try {
            e._run();
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

    e._run = function() {
      if (e._flags & (DISPOSED | RUNNING)) return;

      e._flags = (e._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Mark sources for cleanup
      let node = e._sources;
      while (node) {
        node.version = -1;
        node = node.nextSource;
      }

      const prevComputed = scope.currentComputed;
      scope.currentComputed = e;

      try {
        e._fn();
      } finally {
        scope.currentComputed = prevComputed;
        e._flags &= ~RUNNING;

        // Cleanup unused sources
        let node = e._sources;
        let prev: DependencyNode | undefined;

        while (node) {
          const next = node.nextSource;

          if (node.version === -1) {
            // Remove unused
            if (prev) {
              prev.nextSource = next;
            } else {
              e._sources = next;
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

    e.dispose = function() {
      if (!(e._flags & DISPOSED)) {
        e._flags |= DISPOSED;
        
        // Clear all sources
        let node = e._sources;
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
        
        e._sources = undefined;
      }
    };

    // Run immediately
    e._run();

    // Return dispose function
    return () => e.dispose();
  }

  return { effect };
}