// Dependency node management for efficient linked-list based tracking

import type { DependencyNode, Signal, Computed, Effect } from './types';

// Node pool for recycling
const nodePool: DependencyNode[] = [];
const MAX_POOL_SIZE = 1000;

export function acquireNode<S = unknown, T = unknown>(
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

  return { 
    source: source as Signal | Computed, 
    target: target as Computed | Effect, 
    version: source._version 
  };
}

export function releaseNode(node: DependencyNode): void {
  node.source = undefined!;
  node.target = undefined!;
  node.prevSource = undefined;
  node.nextSource = undefined;
  node.prevTarget = undefined;
  node.nextTarget = undefined;
  node.version = -1;

  if (nodePool.length < MAX_POOL_SIZE) {
    nodePool.push(node);
  }
}

export function addDependency<S = unknown, T = unknown>(
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
  }
  source._targets = node;
}

export function prepareSources<T = unknown>(target: Computed<T> | Effect): void {
  let node = target._sources;
  while (node) {
    node.version = -1; // Mark for potential cleanup
    node = node.nextSource;
  }
}

export function cleanupSources<T = unknown>(target: Computed<T> | Effect): void {
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

      releaseNode(node);
    } else {
      prev = node;
    }

    node = next;
  }
}

export function disposeComputed<T = unknown>(target: Computed<T> | Effect): void {
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

    releaseNode(node);
    node = next;
  }

  target._sources = undefined;
}

export function notifyTargets<T = unknown>(source: Signal<T> | Computed<T>): void {
  let node = source._targets;
  while (node) {
    node.target._notify();
    node = node.nextTarget;
  }
}

// For testing - expose pool state
export function getPoolSize(): number {
  return nodePool.length;
}

export function clearPool(): void {
  nodePool.length = 0;
}
