// Node pool operations - used by all modules that need node management
import type { SignalContext } from '../context';
import type { Consumer, Edge, Producer } from '../types';
import { CONSTANTS } from '../constants';

const { TRACKING, MAX_POOL_SIZE } = CONSTANTS;

export type EdgeCache = { _lastEdge?: Edge; };
export type TrackedProducer<T = unknown> = Producer<T> & EdgeCache;

export function createNodePoolHelpers(ctx: SignalContext) {
  const removeFromTargets = (node: Edge): void => {
    const source = node.source;
    const prevTarget = node.prevTarget;
    const nextTarget = node.nextTarget;
    const hasNextTarget = nextTarget === undefined;

    if (prevTarget !== undefined) {
      prevTarget.nextTarget = nextTarget;
    } else {
      source._targets = nextTarget;

      // If it's a producer that's ALSO a consumer (like computed)
      if (hasNextTarget && '_flags' in source) {
        source._flags &= ~TRACKING;
      }
    }

    if (!hasNextTarget) {
      nextTarget.prevTarget = prevTarget;
    }
  };

  const acquireNode = (): Edge => {
    ctx.allocations++;
    if (ctx.poolSize > 0) return ctx.nodePool[--ctx.poolSize]!;

    return {} as Edge;
  };

  const releaseNode = (node: Edge): void => {
    if (ctx.poolSize >= MAX_POOL_SIZE) return;
    
    // Reset the entire node and add back to the pool
    node.source = undefined!;
    node.target = undefined!;
    node.version = 0;
    node.nextSource = undefined;
    node.prevSource = undefined;
    node.nextTarget = undefined;
    node.prevTarget = undefined;
    ctx.nodePool[ctx.poolSize++] = node;
  };

  const linkNodes = (
    source: TrackedProducer | (TrackedProducer & Consumer),
    target: Consumer,
    version: number
  ): Edge => {
    const newNode = acquireNode();

    newNode.source = source;
    newNode.target = target;
    newNode.version = version;
    newNode.nextSource = target._sources;
    newNode.nextTarget = source._targets;
    newNode.prevSource = undefined;
    newNode.prevTarget = undefined;

    if (source._targets) source._targets.prevTarget = newNode;
    // TODO: this used to be else if with the above. but a computed has both targets
    // AND flags. so it should set both...right? or not?
    // Set TRACKING flag for computed values
    if ('_flags' in source) source._flags |= TRACKING;
    if (target._sources) target._sources.prevSource = newNode;

    target._sources = newNode;
    source._targets = newNode;
    source._lastEdge = newNode; // Store node for reuse

    return newNode;
  };

  return { removeFromTargets, acquireNode, releaseNode, linkNodes };
}