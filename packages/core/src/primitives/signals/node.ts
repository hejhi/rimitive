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
  // Node pool for recycling
  const nodePool: DependencyNode[] = [];
  const MAX_POOL_SIZE = 1000;
  
  // Pre-allocate nodes with stable shapes
  for (let i = 0; i < 100; i++) {
    nodePool.push({
      source: undefined!,
      target: undefined!,
      prevSource: undefined,
      nextSource: undefined,
      prevTarget: undefined,
      nextTarget: undefined,
      version: -1,
      rollbackNode: undefined,
    });
  }

  function acquireNode<S = unknown, T = unknown>(
    source: Signal<S> | Computed<S>,
    target: Computed<T> | Effect
  ): DependencyNode {
    const node = nodePool.pop();
    if (node) {
      node.source = source as Signal | Computed;
      node.target = target as Computed | Effect;
      node.version = source._version;
      return node;
    }

    // Create new node with stable shape - all properties defined
    return {
      source: source as Signal | Computed,
      target: target as Computed | Effect,
      prevSource: undefined,
      nextSource: undefined,
      prevTarget: undefined,
      nextTarget: undefined,
      version: source._version,
      rollbackNode: undefined,
    };
  }

  function releaseNode(node: DependencyNode): void {
    node.source = undefined!;
    node.target = undefined!;
    node.prevSource = undefined;
    node.nextSource = undefined;
    node.prevTarget = undefined;
    node.nextTarget = undefined;
    node.version = -1;
    node.rollbackNode = undefined;

    if (nodePool.length < MAX_POOL_SIZE) {
      nodePool.push(node);
    }
  }

  function addDependency<S = unknown, T = unknown>(
    source: Signal<S> | Computed<S>,
    target: Computed<T> | Effect
  ): void {
    let node = target._sources;

    // Check if we already depend on this source
    while (node) {
      if (node.source === source) {
        node.version = source._version;
        return;
      }
      node = node.nextSource;
    }

    // Create new dependency
    node = acquireNode(source, target);

    // Add to target's source list
    node.nextSource = target._sources;
    if (target._sources) {
      target._sources.prevSource = node;
    }
    target._sources = node;

    // Add to source's target list
    node.nextTarget = source._targets;
    if (source._targets) {
      source._targets.prevTarget = node;
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
      node.version = -1; // Mark for potential cleanup
      node = node.nextSource;
    }
  }

  function cleanupSources<T = unknown>(target: Computed<T> | Effect): void {
    let node = target._sources;
    let prev: DependencyNode | undefined;

    while (node) {
      const next = node.nextSource;

      if (node.version === -1) {
        // Remove this node
        if (prev) {
          prev.nextSource = next;
        } else {
          target._sources = next;
        }
        if (next) {
          next.prevSource = prev;
        }

        // Remove from source's target list
        if (node.prevTarget) {
          node.prevTarget.nextTarget = node.nextTarget;
        } else {
          node.source._targets = node.nextTarget;
        }
        if (node.nextTarget) {
          node.nextTarget.prevTarget = node.prevTarget;
        }
        
        // If this was the last target, clear TRACKING flag
        if (!node.source._targets && '_flags' in node.source && (node.source._flags & IS_COMPUTED)) {
          node.source._flags &= ~TRACKING;
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
      const next = node.nextSource;

      // Remove from source's target list
      if (node.prevTarget) {
        node.prevTarget.nextTarget = node.nextTarget;
      } else {
        node.source._targets = node.nextTarget;
      }
      if (node.nextTarget) {
        node.nextTarget.prevTarget = node.prevTarget;
      }
      
      // If this was the last target, clear TRACKING flag
      if (!node.source._targets && '_flags' in node.source && (node.source._flags & IS_COMPUTED)) {
        node.source._flags &= ~TRACKING;
      }

      releaseNode(node);
      node = next;
    }

    target._sources = undefined;
  }

  function notifyTargets<T = unknown>(source: Signal<T> | Computed<T>): void {
    let node = source._targets;
    while (node) {
      node.target._notify();
      node = node.nextTarget;
    }
  }

  // For testing - expose pool state
  function getPoolSize(): number {
    return nodePool.length;
  }

  function clearPool(): void {
    nodePool.length = 0;
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
