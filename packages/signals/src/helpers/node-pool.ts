// Node pool operations - used by all modules that need node management
import type { SignalContext } from '../context';
import type { Producer, Consumer, Edge } from '../types';
import { CONSTANTS } from '../constants';

const { TRACKING, MAX_POOL_SIZE } = CONSTANTS;

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
    
    node.source = undefined!;
    node.target = undefined!;
    node.version = 0;
    node.nextSource = undefined;
    node.prevSource = undefined;
    node.nextTarget = undefined;
    node.prevTarget = undefined;
    ctx.nodePool[ctx.poolSize++] = node;
  };

  const linkNodes = (source: Producer | Producer & Consumer, target: Consumer, version: number): Edge => {
    const newNode = Object.assign(acquireNode(), {
      source,
      target,
      version: version,
      nextSource: target._sources,
      nextTarget: source._targets,
      prevSource: undefined,
      prevTarget: undefined,
    });
    if (source._targets) {
      source._targets.prevTarget = newNode;
    }
    // TODO: this used to be else if with the above. but a computed has both targets
    // AND flags. so it should set both...right? or not?
    if ('_flags' in source) {
      // Set TRACKING flag for computed values
      source._flags |= TRACKING;
    }
    if (target._sources) {
      target._sources.prevSource = newNode;
    }

    target._sources = newNode;
    source._targets = newNode;
    source._node = newNode; // Store node for reuse

    return newNode;
  };

  return { removeFromTargets, acquireNode, releaseNode, linkNodes };
}