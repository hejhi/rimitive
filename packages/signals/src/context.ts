// Context and shared types for signals implementation
// This module only exports types and factory functions, no global state

import { Computed, DependencyNode, Effect } from "./types";

export const RUNNING = 1 << 2;
export const DISPOSED = 1 << 3;
export const OUTDATED = 1 << 1;
export const NOTIFIED = 1 << 0;
export const TRACKING = 1 << 4;
export const IS_COMPUTED = 1 << 5;

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
  // Shared utilities (not constants - those are inlined for performance)
  removeFromTargets: (node: DependencyNode) => void;
  acquireNode: () => DependencyNode;
  releaseNode: (node: DependencyNode) => void;
}

// Constants
export const MAX_POOL_SIZE = 1000;
export const INITIAL_POOL_SIZE = 100;

// Factory to create a new context
export function createContext(): SignalContext {
  const nodePool = new Array(INITIAL_POOL_SIZE) as DependencyNode[];
  for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
    nodePool[i] = {} as DependencyNode;
  }
  
  // Create the context object that will be returned
  const ctx: SignalContext = {} as SignalContext;
  
  // Initialize basic properties
  ctx.currentComputed = null;
  ctx.version = 0;
  ctx.batchDepth = 0;
  ctx.batchedEffects = null;
  ctx.nodePool = nodePool;
  ctx.poolSize = INITIAL_POOL_SIZE;
  ctx.allocations = 0;
  ctx.poolHits = 0;
  ctx.poolMisses = 0;
  
  // Create context-bound utilities
  ctx.removeFromTargets = (node: DependencyNode): void => {
    const source = node.source;
    const prevTarget = node.prevTarget;
    const nextTarget = node.nextTarget;

    if (prevTarget !== undefined) {
      prevTarget.nextTarget = nextTarget;
    } else {
      source._targets = nextTarget;
      if (nextTarget === undefined && '_flags' in source && typeof source._flags === 'number') {
        source._flags &= ~TRACKING;
      }
    }

    if (nextTarget !== undefined) {
      nextTarget.prevTarget = prevTarget;
    }
  };
  
  ctx.acquireNode = (): DependencyNode => {
    ctx.allocations++;
    return ctx.poolSize > 0
      ? (ctx.poolHits++, ctx.nodePool[--ctx.poolSize]!)
      : (ctx.poolMisses++, {} as DependencyNode);
  };
  
  ctx.releaseNode = (node: DependencyNode): void => {
    if (ctx.poolSize < MAX_POOL_SIZE) {
      node.source = undefined!;
      node.target = undefined!;
      node.version = 0;
      node.nextSource = undefined;
      node.prevSource = undefined;
      node.nextTarget = undefined;
      node.prevTarget = undefined;
      ctx.nodePool[ctx.poolSize++] = node;
    }
  };
  
  return ctx;
}

// Helper function used by all implementations
export function removeFromTargets(node: DependencyNode): void {
  const source = node.source;
  const prevTarget = node.prevTarget;
  const nextTarget = node.nextTarget;

  if (prevTarget !== undefined) {
    prevTarget.nextTarget = nextTarget;
  } else {
    source._targets = nextTarget;
    if (nextTarget === undefined && '_flags' in source && typeof source._flags === 'number') {
      source._flags &= ~TRACKING;
    }
  }

  if (nextTarget !== undefined) {
    nextTarget.prevTarget = prevTarget;
  }
}
