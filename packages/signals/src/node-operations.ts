// Shared dependency node operations used by computed and effect
// Extracted to avoid circular dependencies

import type { DependencyNode, Computed } from './types';
import { activeContext, MAX_POOL_SIZE } from './context';
import { TRACKING } from './types';

// Get a node from pool or create new one
export function acquireNode(): DependencyNode {
  activeContext.allocations++;

  if (activeContext.poolSize > 0) {
    activeContext.poolHits++;
    return activeContext.nodePool[--activeContext.poolSize]!;
  }

  activeContext.poolMisses++;
  return {} as DependencyNode;
}

// Release a node back to the pool
export function releaseNode(node: DependencyNode): void {
  if (activeContext.poolSize >= MAX_POOL_SIZE) return;

  // Clear all references
  node.source = undefined!;
  node.target = undefined!;
  node.version = 0;
  node.nextSource = undefined;
  node.prevSource = undefined;
  node.nextTarget = undefined;
  node.prevTarget = undefined;

  activeContext.nodePool[activeContext.poolSize++] = node;
}

// Batch release for cleanup operations
export function releaseNodes(nodes: DependencyNode[]): void {
  // Calculate how many we can actually pool
  const availableSpace = MAX_POOL_SIZE - activeContext.poolSize;
  const nodesToPool = Math.min(nodes.length, availableSpace);

  if (nodesToPool === 0) return;

  // Clear and add to pool
  for (let i = 0; i < nodesToPool; i++) {
    const node = nodes[i];
    if (!node) continue;
    node.source = undefined!;
    node.target = undefined!;
    node.version = 0;
    node.nextSource = undefined;
    node.prevSource = undefined;
    node.nextTarget = undefined;
    node.prevTarget = undefined;

    activeContext.nodePool[activeContext.poolSize++] = node;
  }
}

// Remove a node from the targets list of its source
export function removeFromTargets(node: DependencyNode): void {
  const source = node.source;
  const prevTarget = node.prevTarget;
  const nextTarget = node.nextTarget;

  if (prevTarget !== undefined) {
    prevTarget.nextTarget = nextTarget;
  } else {
    source._targets = nextTarget;
    // Clear tracking flag if no more targets
    if (nextTarget === undefined && '_flags' in source) {
      (source)._flags &= ~TRACKING;
    }
  }

  if (nextTarget !== undefined) {
    nextTarget.prevTarget = prevTarget;
  }
}


// Link a node into the dependency graph
export function linkNode(
  node: DependencyNode,
  source: Computed | Signal,
  target: Computed | Effect
): void {
  // Link to target's sources
  if (target._sources) {
    target._sources.prevSource = node;
  }
  target._sources = node;

  // Link to source's targets
  if (source._targets) {
    source._targets.prevTarget = node;
  } else if ('_flags' in source) {
    // Set tracking flag for computed
    (source)._flags |= TRACKING;
  }
  source._targets = node;
}

// Import type fix - we need Signal type
import type { Signal, Effect } from './types';