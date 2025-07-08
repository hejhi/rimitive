// Dependency node pooling for performance optimization
// Reduces GC pressure by reusing node objects

import type { DependencyNode } from './types';
import { activeContext, MAX_POOL_SIZE } from './signal';

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

// Return node to pool for reuse
export function releaseNode(node: DependencyNode): void {
  // Only pool if under limit
  if (activeContext.poolSize >= MAX_POOL_SIZE) return;

  // Clear all references to prevent memory leaks
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

// Reset pool (for testing)
export function resetNodePool(): void {
  // Pool is now part of context, reset happens in resetTracking
}

// Get pool statistics (for performance tuning)
export function getPoolStats() {
  return {
    poolSize: activeContext.poolSize,
    maxPoolSize: MAX_POOL_SIZE,
    allocations: activeContext.allocations,
    poolHits: activeContext.poolHits,
    poolMisses: activeContext.poolMisses,
    hitRate: activeContext.allocations > 0 ? activeContext.poolHits / activeContext.allocations : 0,
  };
}
