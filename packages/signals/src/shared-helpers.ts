// Shared helper classes for signals implementation
// These are instantiated at factory level to avoid cross-module performance hits

import type { SignalContext } from './context';
import type { ReactiveNode, ConsumerNode, DependencyNode } from './types';
import { CONSTANTS } from './constants';

const { TRACKING, MAX_POOL_SIZE } = CONSTANTS;

// Core node pool operations - used by all modules that need node management
export class NodePoolManager {
  constructor(private ctx: SignalContext) {}

  removeFromTargets(node: DependencyNode): void {
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

  acquireNode(): DependencyNode {
    this.ctx.allocations++;
    return this.ctx.poolSize > 0
      ? (this.ctx.poolHits++, this.ctx.nodePool[--this.ctx.poolSize]!)
      : (this.ctx.poolMisses++, {} as DependencyNode);
  }

  releaseNode(node: DependencyNode): void {
    if (this.ctx.poolSize < MAX_POOL_SIZE) {
      node.source = undefined!;
      node.target = undefined!;
      node.version = 0;
      node.nextSource = undefined;
      node.prevSource = undefined;
      node.nextTarget = undefined;
      node.prevTarget = undefined;
      this.ctx.nodePool[this.ctx.poolSize++] = node;
    }
  }

  linkNodes(source: ReactiveNode, target: ConsumerNode, version: number): DependencyNode {
    const newNode = this.acquireNode();
    
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
  }
}

// Shared by signal.ts and computed.ts for dependency tracking
export class DependencyTracker {
  constructor(private pool: NodePoolManager) {}

  tryReuseNode(source: ReactiveNode, target: ConsumerNode, version: number): boolean {
    const node = source._node;
    if (node !== undefined && node.target === target) {
      node.version = version;
      return true;
    }
    return false;
  }

  findExistingNode(source: ReactiveNode, target: ConsumerNode, version: number): boolean {
    let node = target._sources;
    while (node) {
      if (node.source === source) {
        node.version = version;
        return true;
      }
      node = node.nextSource;
    }
    return false;
  }

  addDependency(source: ReactiveNode, target: ConsumerNode, version: number): void {
    if (this.tryReuseNode(source, target, version)) return;
    if (this.findExistingNode(source, target, version)) return;
    this.pool.linkNodes(source, target, version);
  }
}

// Shared by computed.ts and effect.ts for source cleanup
export class SourceCleaner {
  constructor(private pool: NodePoolManager) {}

  disposeAllSources(consumer: ConsumerNode): void {
    let node = consumer._sources;
    while (node) {
      const next = node.nextSource;
      this.pool.removeFromTargets(node);
      this.pool.releaseNode(node);
      node = next;
    }
    consumer._sources = undefined;
  }

  cleanupSources(consumer: ConsumerNode): void {
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

        this.pool.removeFromTargets(node);
        this.pool.releaseNode(node);
      } else {
        prev = node;
      }

      node = next;
    }
  }
}