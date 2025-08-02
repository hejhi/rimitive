// Dependency tracking helpers - shared by signal.ts and computed.ts
import { CONSTANTS } from '../constants';
import type { ProducerNode, ConsumerNode, Edge } from '../types';
import type { SignalContext } from '../context';

export type EdgeCache = { _lastEdge?: Edge };
export type TrackedProducer = ProducerNode & EdgeCache;

const { TRACKING, NOTIFIED, OUTDATED } = CONSTANTS;

export interface DependencyHelpers {
  linkNodes: (source: TrackedProducer | (TrackedProducer & ConsumerNode), target: ConsumerNode, version: number) => Edge;
  addDependency: (source: TrackedProducer, target: ConsumerNode, version: number) => void;
  removeFromTargets: (edge: Edge) => void;
  checkNodeDirty: (node: ConsumerNode & { _globalVersion?: number }, ctx: SignalContext) => boolean;
  shouldNodeUpdate: (node: ConsumerNode & { _flags: number; _globalVersion?: number }, ctx: SignalContext) => boolean;
}

export function createDependencyHelpers(): DependencyHelpers {
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
       prevSource: undefined,
       prevTarget: undefined,
       nextSource,
       nextTarget,
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
    const isLastTarget = nextTarget === undefined;

    if (prevTarget !== undefined) {
      prevTarget.nextTarget = nextTarget;
    } else {
      source._targets = nextTarget;

      // If it's a producer that's ALSO a consumer (like computed)
      if (isLastTarget && '_flags' in source && typeof source._flags === 'number') {
        source._flags &= ~TRACKING;
      }
    }

    if (!isLastTarget) {
      nextTarget.prevTarget = prevTarget;
    }
  };

  /**
   * Checks if a reactive node (computed or effect) is dirty
   * by recursively checking all its source dependencies.
   */
  const checkNodeDirty = (
    node: ConsumerNode & { _globalVersion?: number },
    ctx: SignalContext
  ): boolean => {
    // Fast path: global version hasn't changed
    if (node._globalVersion === ctx.version) return false;
    
    // Check if any source changed
    let source = node._sources;
    while (source) {
      const sourceNode = source.source;
      
      // For computed sources, recursively update and check if changed
      if ('_update' in sourceNode && '_flags' in sourceNode && typeof (sourceNode as unknown as {_update: unknown})._update === 'function') {
        const oldVersion = sourceNode._version;
        (sourceNode as unknown as {_update(): void})._update();
        if (oldVersion !== sourceNode._version) return true;
      } else if (source.version !== sourceNode._version) {
        // Signal changed
        return true;
      }
      
      // Update edge version to match source
      source.version = sourceNode._version;
      source = source.nextSource;
    }
    
    // All sources clean - update global version
    node._globalVersion = ctx.version;
    return false;
  };

  /**
   * Shared update logic for reactive nodes that use lazy evaluation.
   * Returns true if the node should execute its callback.
   */
  const shouldNodeUpdate = (
    node: ConsumerNode & { _flags: number; _globalVersion?: number },
    ctx: SignalContext
  ): boolean => {
    const flags = node._flags;
    
    // Fast path: already clean
    if (!(flags & (OUTDATED | NOTIFIED))) return false;
    
    // If OUTDATED, definitely update
    if (flags & OUTDATED) return true;
    
    // If only NOTIFIED, check if actually dirty
    if (flags & NOTIFIED) {
      if (checkNodeDirty(node, ctx)) {
        node._flags |= OUTDATED;
        return true;
      } else {
        node._flags &= ~NOTIFIED;
        return false;
      }
    }
    
    return false;
  };

  return { addDependency, removeFromTargets, linkNodes, checkNodeDirty, shouldNodeUpdate };
}