// Computed value implementation

import type { Computed } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED } from './types';
import { SignalScope } from './scope';
import { NodeScope } from './node';

export type ComputedScope = {
  computed: <T>(fn: () => T) => Computed<T>;
  isOutdated: <T>(computed: Computed<T>) => boolean;
};

export function createComputedScope(
  scope: SignalScope,
  node: NodeScope
): ComputedScope {
  function computed<T>(fn: () => T): Computed<T> {
    const c: Computed<T> = function () {
      // Check if we need to recompute
      if (c._flags & DISPOSED) {
        throw new Error('Computed is disposed');
      }

      // Register as dependency if being tracked
      const current = scope.getCurrentComputed();
      if (current && current._flags & RUNNING) {
        node.addDependency(c, current);
      }

      if (c._globalVersion !== scope.globalVersion) {
        // Something changed globally, check our sources
        let outdated = false;
        let node = c._sources;

        while (node) {
          if (node.version !== node.source._version) {
            outdated = true;
            break;
          }
          node = node.nextSource;
        }

        if (outdated) {
          c._flags |= OUTDATED;
        }
        c._globalVersion = scope.globalVersion;
      }

      if (c._flags & OUTDATED) {
        return c._recompute();
      }

      return c._value!;
    } as Computed<T>;

    c._fn = fn;
    c._version = 0;
    c._globalVersion = 0;
    c._flags = OUTDATED;

    c._notify = function () {
      if (!(c._flags & NOTIFIED)) {
        c._flags |= NOTIFIED | OUTDATED;
        // Propagate notification to our targets
        node.notifyTargets(c);
      }
    };

    c._recompute = function () {
      if (c._flags & RUNNING) {
        throw new Error('Cycle detected');
      }

      c._flags |= RUNNING;
      c._flags &= ~NOTIFIED;

      // Prepare sources for potential cleanup
      node.prepareSources(c);

      const prevComputed = scope.getCurrentComputed();
      scope.setCurrentComputed(c);

      try {
        c._value = c._fn();
        c._version++;
      } finally {
        scope.setCurrentComputed(prevComputed);
        c._flags &= ~(RUNNING | OUTDATED);
      }

      // Clean up unused sources
      node.cleanupSources(c);

      return c._value;
    };

    c.dispose = function () {
      if (!(c._flags & DISPOSED)) {
        c._flags |= DISPOSED;
        node.disposeComputed(c);
        c._value = undefined;
      }
    };

    return c;
  }

  // Utility function to check if a computed needs recalculation
  function isOutdated<T>(computed: Computed<T>): boolean {
    return !!(computed._flags & OUTDATED);
  }

  return {
    computed,
    isOutdated,
  };
}
