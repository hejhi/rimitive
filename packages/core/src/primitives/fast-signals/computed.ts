// Computed value implementation

import type { Computed } from './types';
import { NOTIFIED, OUTDATED, RUNNING, DISPOSED } from './types';
import {
  prepareSources,
  cleanupSources,
  disposeComputed,
  notifyTargets,
  addDependency,
} from './node';
import {
  globalVersion,
  setCurrentComputed,
  getCurrentComputed,
} from './global';

export function computed<T>(fn: () => T): Computed<T> {
  const c: Computed<T> = function () {
    // Check if we need to recompute
    if (c._flags & DISPOSED) {
      throw new Error('Computed is disposed');
    }

    // Register as dependency if being tracked
    const current = getCurrentComputed();
    if (current && current._flags & RUNNING) {
      addDependency(c, current);
    }

    if (c._globalVersion !== globalVersion) {
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
      c._globalVersion = globalVersion;
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
      notifyTargets(c);
    }
  };

  c._recompute = function () {
    if (c._flags & RUNNING) {
      throw new Error('Cycle detected');
    }

    c._flags |= RUNNING;
    c._flags &= ~NOTIFIED;

    // Prepare sources for potential cleanup
    prepareSources(c);

    const prevComputed = getCurrentComputed();
    setCurrentComputed(c);

    try {
      c._value = c._fn();
      c._version++;
    } finally {
      setCurrentComputed(prevComputed);
      c._flags &= ~(RUNNING | OUTDATED);
    }

    // Clean up unused sources
    cleanupSources(c);

    return c._value;
  };

  c.dispose = function () {
    if (!(c._flags & DISPOSED)) {
      c._flags |= DISPOSED;
      disposeComputed(c);
      c._value = undefined;
    }
  };

  return c;
}

// Utility function to check if a computed needs recalculation
export function isOutdated<T>(computed: Computed<T>): boolean {
  return !!(computed._flags & OUTDATED);
}
