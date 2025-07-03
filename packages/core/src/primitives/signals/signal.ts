// Signal implementation

import type { Signal } from './types';
import { RUNNING } from './types';
import { SignalScope } from './scope';
import { BatchScope } from './batch';
import { NodeScope } from './node';

export function createScopedSignalFactory(
  scope: SignalScope,
  batch: BatchScope,
  node: NodeScope
) {
  function signal<T>(value: T): Signal<T> {
    const s: Signal<T> = function () {
      // Ultra-fast read path with minimized branching
      // Only check if we have a current computed (most common case: no tracking)
      const current = scope.currentComputed;
      if (current !== null && (current._flags & RUNNING)) {
        node.addDependency(s, current);
      }
      return s._value;
    } as Signal<T>;

    s._value = value;
    s._version = 0;

    return s;
  }

  // Write to a signal (internal use only for set() function)
  function writeSignal<T>(signal: Signal<T>, value: T): void {
    if (signal._value !== value) {
      signal._value = value;
      signal._version++;
      scope.incrementGlobalVersion();

      if (!batch.batchDepth) {
        node.notifyTargets(signal);
      } else {
        // In batch - just mark targets as outdated
        let node = signal._targets;
        while (node) {
          node.target._notify();
          node = node.nextTarget;
        }
      }
    }
  }

  function untrack<T>(fn: () => T): T {
    const prev = scope.currentComputed;
    try {
      // Temporarily disable tracking
      scope.currentComputed = null;
      return fn();
    } finally {
      scope.currentComputed = prev;
    }
  }

  return {
    signal,
    writeSignal,
    peek,
    untrack,
  };
}

// Utility functions for signals
export function peek<T>(signal: Signal<T>): T {
  return signal._value;
}
