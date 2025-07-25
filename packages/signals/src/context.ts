// Context and shared types for signals implementation
// This module only exports types and factory functions, no global state

import { CONSTANTS } from "./constants";
import { Computed, ConsumerNode, DependencyNode, Effect, ReactiveNode } from "./types";

const { TRACKING } = CONSTANTS;

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
  linkNodes: (source: ReactiveNode, target: ConsumerNode, version: number) => DependencyNode;
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
  
  ctx.linkNodes = (source: ReactiveNode, target: ConsumerNode, version: number): DependencyNode => {
    const newNode = ctx.acquireNode();
    
    newNode.source = source;
    newNode.target = target;
    newNode.version = version;
    newNode.nextSource = target._sources;
    newNode.nextTarget = source._targets;
    newNode.prevSource = undefined;
    newNode.prevTarget = undefined;
    
    if (target._sources) {
      target._sources.prevSource = newNode;
    }
    target._sources = newNode;
    
    if (source._targets) {
      source._targets.prevTarget = newNode;
    } else if ('_flags' in source && typeof source._flags === 'number') {
      // Set TRACKING flag for computed values
      source._flags |= TRACKING;
    }
    source._targets = newNode;
    
    // Store node for reuse
    source._node = newNode;
    
    return newNode;
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
