// Context and shared types for signals implementation
// This module only exports types and factory functions, no global state

import { CONSTANTS } from "./constants";
import { Computed, DependencyNode, Effect } from "./types";

const { INITIAL_POOL_SIZE } = CONSTANTS;

interface SubscribeNode {
  _execute(): void;
}

export interface SignalContext {
  currentComputed: Computed | Effect | null;
  version: number;
  batchDepth: number;
  batchedEffects: Effect | null;
  subscribeBatch?: Set<SubscribeNode>;
  nodePool: DependencyNode[];
  poolSize: number;
  allocations: number;
  poolHits: number;
  poolMisses: number;
}

// Factory to create a new context
export function createContext(): SignalContext {
  const nodePool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    nodePool[i] = {} as DependencyNode;
  }
  
  return {
    currentComputed: null,
    version: 0,
    batchDepth: 0,
    batchedEffects: null,
    nodePool: nodePool,
    poolSize: INITIAL_POOL_SIZE,
    allocations: 0,
    poolHits: 0,
    poolMisses: 0,
  };
}
