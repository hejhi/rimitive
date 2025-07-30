// Dependency tracking helpers - shared by signal.ts and computed.ts
import { CONSTANTS } from '../constants';
import type { ProducerNode, ConsumerNode, Edge } from '../types';

export type EdgeCache = { _lastEdge?: Edge };
export type TrackedProducer = ProducerNode & EdgeCache;

const { TRACKING } = CONSTANTS;

export function createDependencyHelpers() {
   const linkNodes = (
     source: TrackedProducer | (TrackedProducer & ConsumerNode),
     target: ConsumerNode,
     version: number
   ): Edge => {
     const nextSource = target._sources;
     const nextTarget = source._targets;
     const newNode: Edge = {
       source,
       target,
       version,
       nextSource,
       nextTarget,
       prevSource: undefined,
       prevTarget: undefined,
     };

     if (nextTarget) nextTarget.prevTarget = newNode;
     // TODO: this used to be else if with the above. but a computed has both targets
     // AND flags. so it should set both...right? or not?
     // Set TRACKING flag for computed values
     if ('_flags' in source && typeof source._flags === 'number') source._flags |= TRACKING;
     if (nextSource) nextSource.prevSource = newNode;

     target._sources = newNode;
     source._targets = newNode;
     source._lastEdge = newNode; // Store node for reuse

     return newNode;
   };
  
  const addDependency = (
    source: ProducerNode & EdgeCache,
    target: ConsumerNode,
    version: number
  ): void => {
    let node = source._lastEdge;
    if (node !== undefined && node.target === target) {
      node.version = version;
      return;
    }
    node = target._sources;
    while (node) {
      if (node.source === source) {
        node.version = version;
        return;
      }
      node = node.nextSource;
    }

    linkNodes(source, target, version);
  };

  const removeFromTargets = ({ source, prevTarget, nextTarget }: Edge): void => {
    const hasNextTarget = nextTarget === undefined;

    if (prevTarget !== undefined) {
      prevTarget.nextTarget = nextTarget;
    } else {
      source._targets = nextTarget;

      // If it's a producer that's ALSO a consumer (like computed)
      if (hasNextTarget && '_flags' in source && typeof source._flags === 'number') {
        source._flags &= ~TRACKING;
      }
    }

    if (!hasNextTarget) {
      nextTarget.prevTarget = prevTarget;
    }
  };

  return { addDependency, removeFromTargets, linkNodes };
}