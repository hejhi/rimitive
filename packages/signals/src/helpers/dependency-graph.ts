/**
 * ALGORITHM: Bidirectional Dependency Graph Management
 * 
 * This module composes the core graph algorithms that power the reactive system.
 * The key insight is using a bidirectional graph with intrusive linked lists:
 * 
 * INSPIRATION:
 * - Glimmer's reference system (version tracking)
 * - Linux kernel's intrusive lists (memory efficiency)  
 * - V8's inline caches (edge caching)
 * - Database query planners (dependency analysis)
 */
import type { ProducerNode, ConsumerNode, Edge, ToNode, ScheduledNode } from '../types';
import { createGraphEdges, type GraphEdges } from './graph-edges';
import { createNodeState, type NodeState } from './node-state';
import { createPushPropagator, type PushPropagator } from './push-propagator';
import { createPullPropagator, type PullPropagator } from './pull-propagator';

export interface DependencyGraph {
  // Edge management
  addEdge: (
    producer: ProducerNode,
    consumer: ConsumerNode
  ) => void;
  removeEdge: (edge: Edge) => Edge | undefined;

  // Cleanup operations
  detachAll: (consumer: ConsumerNode) => void;
  pruneStale: (consumer: ConsumerNode) => void;

  // Staleness checks
  checkStale: (node: ToNode) => void; // Single-pass update of entire dependency chain

  // Invalidation strategies
  invalidate: (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ) => void;
}

export function createDependencyGraph(): DependencyGraph {
  // Create node state manager
  const nodeState: NodeState = createNodeState();
  
  // Create graph edges with node state dependency
  const graphEdges: GraphEdges = createGraphEdges(nodeState.setStatus);
  
  // Create propagators with their dependencies
  const pushPropagator: PushPropagator = createPushPropagator(nodeState);
  const pullPropagator: PullPropagator = createPullPropagator(nodeState);

  return {
    // Delegate to composed helpers
    addEdge: graphEdges.addEdge,
    removeEdge: graphEdges.removeEdge,
    detachAll: graphEdges.detachAll,
    pruneStale: graphEdges.pruneStale,
    checkStale: pullPropagator.checkStale,
    invalidate: pushPropagator.invalidate,
  };
}