// Shared context for all reactive primitives
// This is the minimal shared state needed by signal, computed, and effect

import type { DependencyNode, Computed, Effect } from './types';

// Context for tracking state
export interface SignalContext {
  currentComputed: Computed | Effect | null;
  version: number;
  batchDepth: number;
  batchedEffects: Effect | null;
  // Node pool state
  nodePool: DependencyNode[];
  poolSize: number;
  allocations: number;
  poolHits: number;
  poolMisses: number;
}

// Pool configuration
export const MAX_POOL_SIZE = 1000;
export const INITIAL_POOL_SIZE = 100;

// Initialize a node pool
function initializeNodePool(): DependencyNode[] {
  const pool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    pool[i] = {} as DependencyNode;
  }
  return pool;
}

// Active context - direct mutation for performance
export let activeContext: SignalContext = {
  currentComputed: null,
  version: 0,
  batchDepth: 0,
  batchedEffects: null,
  nodePool: initializeNodePool(),
  poolSize: INITIAL_POOL_SIZE,
  allocations: 0,
  poolHits: 0,
  poolMisses: 0,
};

// For testing - reset the context
export function resetContext(): void {
  activeContext = {
    currentComputed: null,
    version: 0,
    batchDepth: 0,
    batchedEffects: null,
    nodePool: initializeNodePool(),
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
    poolHits: 0,
    poolMisses: 0,
  };
}