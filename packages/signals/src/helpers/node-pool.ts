// Node pool operations - used by all modules that need node management
import type { SignalContext } from '../context';
import type { ReactiveNode, ConsumerNode, DependencyNode } from '../types';
import { CONSTANTS } from '../constants';

const { TRACKING, MAX_POOL_SIZE } = CONSTANTS;

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