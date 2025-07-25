// Shared helper functions for signals implementation
// These are used at factory level to avoid cross-module performance hits

import type { SignalContext } from './context';
import type { ReactiveNode, ConsumerNode, DependencyNode } from './types';
import { CONSTANTS } from './constants';

const { TRACKING, MAX_POOL_SIZE } = CONSTANTS;

// Core node pool operations - used by all modules that need node management
export function createNodePoolHelpers(ctx: SignalContext) {
  const removeFromTargets = (node: DependencyNode): void => {
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

  const acquireNode = (): DependencyNode => {
    ctx.allocations++;
    return ctx.poolSize > 0
      ? (ctx.poolHits++, ctx.nodePool[--ctx.poolSize]!)
      : (ctx.poolMisses++, {} as DependencyNode);
  };

  const releaseNode = (node: DependencyNode): void => {
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

  const linkNodes = (source: ReactiveNode, target: ConsumerNode, version: number): DependencyNode => {
    const newNode = acquireNode();
    
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

  return { removeFromTargets, acquireNode, releaseNode, linkNodes };
}

// Shared by signal.ts and computed.ts for dependency tracking
export function createDependencyHelpers(pool: ReturnType<typeof createNodePoolHelpers>) {
  const tryReuseNode = (source: ReactiveNode, target: ConsumerNode, version: number): boolean => {
    const node = source._node;
    if (node !== undefined && node.target === target) {
      node.version = version;
      return true;
    }
    return false;
  };

  const findExistingNode = (source: ReactiveNode, target: ConsumerNode, version: number): boolean => {
    let node = target._sources;
    while (node) {
      if (node.source === source) {
        node.version = version;
        return true;
      }
      node = node.nextSource;
    }
    return false;
  };

  const addDependency = (source: ReactiveNode, target: ConsumerNode, version: number): void => {
    if (tryReuseNode(source, target, version)) return;
    if (findExistingNode(source, target, version)) return;
    pool.linkNodes(source, target, version);
  };

  return { addDependency };
}

// Shared by computed.ts and effect.ts for source cleanup
export function createSourceCleanupHelpers(pool: ReturnType<typeof createNodePoolHelpers>) {
  const disposeAllSources = (consumer: ConsumerNode): void => {
    let node = consumer._sources;
    while (node) {
      const next = node.nextSource;
      pool.removeFromTargets(node);
      pool.releaseNode(node);
      node = next;
    }
    consumer._sources = undefined;
  };

  const cleanupSources = (consumer: ConsumerNode): void => {
    let node = consumer._sources;
    let prev: DependencyNode | undefined;

    while (node !== undefined) {
      const next = node.nextSource;

      if (node.version === -1) {
        // Remove this node from the linked list
        if (prev !== undefined) {
          prev.nextSource = next;
        } else {
          consumer._sources = next;
        }

        if (next !== undefined) {
          next.prevSource = prev;
        }

        pool.removeFromTargets(node);
        pool.releaseNode(node);
      } else {
        prev = node;
      }

      node = next;
    }
  };

  return { disposeAllSources, cleanupSources };
}