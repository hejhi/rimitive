// Dependency node management for efficient linked-list based tracking

import type { DependencyNode, Signal, Computed, Effect } from './types';
import { TRACKING, IS_COMPUTED } from './types';

export type NodeScope = {
  acquireNode: <S = unknown, T = unknown>(
    source: Signal<S> | Computed<S>,
    target: Computed<T> | Effect
  ) => DependencyNode;
  releaseNode: (node: DependencyNode) => void;
  addDependency: <S = unknown, T = unknown>(
    source: Signal<S> | Computed<S>,
    target: Computed<T> | Effect
  ) => void;
  prepareSources: <T = unknown>(target: Computed<T> | Effect) => void;
  cleanupSources: <T = unknown>(target: Computed<T> | Effect) => void;
  disposeComputed: <T = unknown>(target: Computed<T> | Effect) => void;
  notifyTargets: <T = unknown>(source: Signal<T> | Computed<T>) => void;
  getPoolSize: () => number;
  clearPool: () => void;
};

export function createNodeScope() {
  function acquireNode<S = unknown, T = unknown>(
    source: Signal<S> | Computed<S>,
    target: Computed<T> | Effect
  ): DependencyNode {
    // Create new node with stable shape - all properties defined
    return {
      _source: source as Signal | Computed,
      _target: target as Computed | Effect,
      _prevSource: undefined,
      _nextSource: undefined,
      _prevTarget: undefined,
      _nextTarget: undefined,
      _version: source._version,
      _rollbackNode: undefined,
    };
  }

  function releaseNode(_node: DependencyNode): void {
    // No-op - let GC handle it
  }

  function addDependency<S = unknown, T = unknown>(
    source: Signal<S> | Computed<S>,
    target: Computed<T> | Effect
  ): void {
    // Check if we already depend on this source
    let node = target._sources;
    while (node) {
      if (node._source === source) {
        node._version = source._version;
        return;
      }
      node = node._nextSource;
    }

    // Create new dependency
    node = acquireNode(source, target);

    // Add to target's source list (at head for better cache locality)
    node._nextSource = target._sources;
    if (target._sources) {
      target._sources._prevSource = node;
    }
    target._sources = node;

    // Add to source's target list (at head)
    node._nextTarget = source._targets;
    if (source._targets) {
      source._targets._prevTarget = node;
    } else {
      // First target - set TRACKING flag if it's a computed
      if ('_flags' in source && (source._flags & IS_COMPUTED)) {
        source._flags |= TRACKING;
      }
    }
    source._targets = node;
  }

  function prepareSources<T = unknown>(target: Computed<T> | Effect): void {
    let node = target._sources;
    while (node) {
      node._version = -1; // Mark for potential cleanup
      node = node._nextSource;
    }
  }

  function cleanupSources<T = unknown>(target: Computed<T> | Effect): void {
    let node = target._sources;
    let prev: DependencyNode | undefined;

    while (node) {
      const next = node._nextSource;

      if (node._version === -1) {
        // This node was not reused - remove it
        if (prev) {
          prev._nextSource = next;
        } else {
          target._sources = next;
        }
        if (next) {
          next._prevSource = prev;
        }

        // Remove from source's target list
        if (node._prevTarget) {
          node._prevTarget._nextTarget = node._nextTarget;
        } else {
          node._source._targets = node._nextTarget;
        }
        if (node._nextTarget) {
          node._nextTarget._prevTarget = node._prevTarget;
        }
        
        // If this was the last target, clear TRACKING flag
        if (!node._source._targets && '_flags' in node._source && (node._source._flags & IS_COMPUTED)) {
          node._source._flags &= ~TRACKING;
        }

        releaseNode(node);
      } else {
        prev = node;
      }

      node = next;
    }
  }

  function disposeComputed<T = unknown>(target: Computed<T> | Effect): void {
    // Remove all source dependencies
    let node = target._sources;
    while (node) {
      const next = node._nextSource;

      // Remove from source's target list
      if (node._prevTarget) {
        node._prevTarget._nextTarget = node._nextTarget;
      } else {
        node._source._targets = node._nextTarget;
      }
      if (node._nextTarget) {
        node._nextTarget._prevTarget = node._prevTarget;
      }
      
      // If this was the last target, clear TRACKING flag
      if (!node._source._targets && '_flags' in node._source && (node._source._flags & IS_COMPUTED)) {
        node._source._flags &= ~TRACKING;
      }

      releaseNode(node);
      node = next;
    }

    target._sources = undefined;
  }

  function notifyTargets<T = unknown>(source: Signal<T> | Computed<T>): void {
    let node = source._targets;
    while (node) {
      node._target._notify();
      node = node._nextTarget;
    }
  }

  // For testing - expose pool state
  function getPoolSize(): number {
    return 0; // No pool anymore
  }

  function clearPool(): void {
    // No-op - no pool to clear
  }

  return {
    acquireNode,
    releaseNode,
    addDependency,
    prepareSources,
    cleanupSources,
    disposeComputed,
    notifyTargets,
    getPoolSize,
    clearPool,
  };
}
