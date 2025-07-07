// Dependency node pooling for performance optimization
// Reduces GC pressure by reusing node objects

import type { DependencyNode } from './types';

// Pool configuration
const MAX_POOL_SIZE = 1000; // Prevent unbounded growth
const INITIAL_POOL_SIZE = 100; // Pre-allocate common case
// const GROWTH_FACTOR = 2; // How fast to grow when needed - unused for now

// Pool state
let nodePool: DependencyNode[] = [];
let poolSize = 0;

// Performance metrics (useful for tuning)
let allocations = 0;
let poolHits = 0;
let poolMisses = 0;

// Initialize pool with pre-allocated nodes
function initializePool(): void {
  nodePool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    nodePool[i] = {} as DependencyNode;
  }
  poolSize = INITIAL_POOL_SIZE;
}

// Get a node from pool or create new one
export function acquireNode(): DependencyNode {
  allocations++;

  if (poolSize) {
    poolHits++;
    return nodePool[--poolSize]!;
  }

  poolMisses++;
  return {} as DependencyNode;
}

// Return node to pool for reuse
export function releaseNode(node: DependencyNode): void {
  // Only pool if under limit
  if (poolSize >= MAX_POOL_SIZE) return;

  // Clear all references to prevent memory leaks
  node.source = undefined!;
  node.target = undefined!;
  node.version = 0;
  node.nextSource = undefined;
  node.prevSource = undefined;
  node.nextTarget = undefined;
  node.prevTarget = undefined;

  nodePool[poolSize++] = node;
}

// Batch release for cleanup operations
export function releaseNodes(nodes: DependencyNode[]): void {
  // Calculate how many we can actually pool
  const availableSpace = MAX_POOL_SIZE - poolSize;
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

    nodePool[poolSize++] = node;
  }
}

// Reset pool (for testing)
export function resetNodePool(): void {
  nodePool = [];
  poolSize = 0;
  allocations = 0;
  poolHits = 0;
  poolMisses = 0;
}

// Get pool statistics (for performance tuning)
export function getPoolStats() {
  return {
    poolSize,
    maxPoolSize: MAX_POOL_SIZE,
    allocations,
    poolHits,
    poolMisses,
    hitRate: allocations > 0 ? poolHits / allocations : 0,
  };
}

// Initialize on module load
initializePool();
