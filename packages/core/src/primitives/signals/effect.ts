// Effect implementation

import type { Effect } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED } from './types';
import { NodeScope } from './node';
import { SignalScope } from './scope';
import { BatchScope } from './batch';

export type EffectScope = {
  effect: (fn: () => void) => () => void;
  runOnce: (fn: () => void) => void;
  safeEffect: (
    fn: () => void,
    onError?: (error: unknown) => void
  ) => () => void;
};

export function createEffectScope(
  scope: SignalScope,
  batch: BatchScope,
  node: NodeScope
): EffectScope {
  function effect(fn: () => void): () => void {
    const e: Effect = {
      _fn: fn,
      _flags: OUTDATED,

      _notify() {
        if (!(e._flags & NOTIFIED)) {
          e._flags |= NOTIFIED | OUTDATED;
          if (!batch.getBatchDepth()) {
            e._run();
          } else {
            batch.addToBatch(e);
          }
        }
      },

      _run() {
        if (e._flags & DISPOSED) return;
        if (e._flags & RUNNING) return;

        e._flags |= RUNNING;
        e._flags &= ~(NOTIFIED | OUTDATED);

        node.prepareSources(e);

        const prevComputed = scope.getCurrentComputed();
        scope.setCurrentComputed(e);

        try {
          e._fn();
        } finally {
          scope.setCurrentComputed(prevComputed);
          e._flags &= ~RUNNING;
        }

        node.cleanupSources(e);
      },

      dispose() {
        if (!(e._flags & DISPOSED)) {
          e._flags |= DISPOSED;
          node.disposeComputed(e);
        }
      },
    };

    // Run immediately
    e._run();

    // Return dispose function
    return () => e.dispose();
  }

  // Create an effect that runs once
  function runOnce(fn: () => void): void {
    const dispose = effect(fn);
    dispose();
  }

  // Create an effect with error handling
  function safeEffect(
    fn: () => void,
    onError?: (error: unknown) => void
  ): () => void {
    return effect(() => {
      try {
        fn();
      } catch (error) {
        if (onError) {
          onError(error);
        } else {
          console.error('Effect error:', error);
        }
      }
    });
  }

  return {
    effect,
    runOnce,
    safeEffect,
  };
}
