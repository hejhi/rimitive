// Effect implementation

import type { Effect } from './types';
import { OUTDATED } from './types';
import { isNotified, isDisposed, isRunning, markStale, clearNotified, clearOutdated, setRunning, clearRunning, setDisposed } from './flags';
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

// Stable helper functions - no 'this' binding
function notifyEffect(effect: Effect, batch: BatchScope, scope: SignalScope, node: NodeScope): void {
  if (!isNotified(effect._flags)) {
    effect._flags = markStale(effect._flags);
    if (!batch.batchDepth) {
      runEffect(effect, scope, node);
    } else {
      batch.addToBatch(effect);
    }
  }
}

function runEffect(effect: Effect, scope: SignalScope, node: NodeScope): void {
  if (isDisposed(effect._flags)) return;
  if (isRunning(effect._flags)) return;

  effect._flags = setRunning(effect._flags);
  effect._flags = clearNotified(clearOutdated(effect._flags));

  node.prepareSources(effect);

  const prevComputed = scope.currentComputed;
  scope.currentComputed = effect;

  try {
    effect._fn();
  } finally {
    scope.currentComputed = prevComputed;
    effect._flags = clearRunning(effect._flags);
  }

  node.cleanupSources(effect);
}

function disposeEffect(effect: Effect, node: NodeScope): void {
  if (!isDisposed(effect._flags)) {
    effect._flags = setDisposed(effect._flags);
    node.disposeComputed(effect);
  }
}

export function createEffectScope(
  scope: SignalScope,
  batch: BatchScope,
  node: NodeScope
): EffectScope {
  function effect(fn: () => void): () => void {
    // Create effect with stable shape - all properties defined upfront
    const e: Effect = {
      _fn: fn,
      _flags: OUTDATED,
      _sources: undefined,
      _sourcesTail: undefined,
      _nextBatchedEffect: undefined,
      
      // Pre-bound stable functions - no 'this' needed
      _notify: () => notifyEffect(e, batch, scope, node),
      _run: () => runEffect(e, scope, node),
      dispose: () => disposeEffect(e, node),
    };

    // Run immediately
    runEffect(e, scope, node);

    // Return dispose function
    return () => disposeEffect(e, node);
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
