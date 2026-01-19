import type { RimitiveEvent } from './messageHandler';
import type { GraphNode, GraphEdge, GraphNodeType } from './graphTypes';
import type { SourceLocation } from './types';
import { graphState, addNode, addEdge, removeEdge, selectedNodeId } from './graphState';
import { resolveSourceLocation } from '../utils/sourceMapResolver';

/**
 * Snapshot data from the signals package instrumentation
 */
type GraphSnapshot = {
  nodes: Array<{
    id: string;
    type: 'signal' | 'computed' | 'effect';
    name: string;
    sourceLocation?: SourceLocation;
  }>;
  edges: Array<{ producerId: string; consumerId: string }>;
};

/**
 * Process graph-related events to maintain dependency graph state
 */
export function processGraphEvent(event: RimitiveEvent): void {
  switch (event.type) {
    case 'graph:snapshot':
      handleGraphSnapshot(event);
      break;

    case 'signal:read':
    case 'signal:write':
      void handleSignalEvent(event);
      break;

    case 'computed:read':
    case 'computed:value':
      void handleComputedEvent(event);
      break;

    case 'effect:run':
    case 'effect:created':
      void handleEffectEvent(event);
      break;

    case 'dependency:tracked':
      handleDependencyTracked(event);
      break;

    case 'dependency:pruned':
      handleDependencyPruned(event);
      break;

    case 'effect:dispose':
      handleEffectDispose();
      break;
  }
}

/**
 * Handle signal events - ensure node exists with source location
 */
async function handleSignalEvent(event: RimitiveEvent): Promise<void> {
  const data = event.data as {
    signalId?: string;
    name?: string;
    sourceLocation?: SourceLocation;
  } | undefined;

  if (!data?.signalId) return;

  const state = graphState();
  const existingNode = state.nodes.get(data.signalId);

  // Only update if we don't have source location yet, or if this event has one
  if (existingNode?.sourceLocation && !data.sourceLocation) return;

  // Resolve source location if present
  let resolvedLocation = data.sourceLocation;
  if (resolvedLocation) {
    resolvedLocation = await resolveSourceLocation(resolvedLocation);
  }

  addNode({
    id: data.signalId,
    type: 'signal',
    name: resolvedLocation?.display ?? data.name,
    contextId: event.contextId,
    sourceLocation: resolvedLocation,
    created: existingNode?.created ?? event.timestamp ?? Date.now(),
  });
}

/**
 * Handle computed events - ensure node exists with source location
 */
async function handleComputedEvent(event: RimitiveEvent): Promise<void> {
  const data = event.data as {
    computedId?: string;
    name?: string;
    sourceLocation?: SourceLocation;
  } | undefined;

  if (!data?.computedId) return;

  const state = graphState();
  const existingNode = state.nodes.get(data.computedId);

  // Only update if we don't have source location yet, or if this event has one
  if (existingNode?.sourceLocation && !data.sourceLocation) return;

  // Resolve source location if present
  let resolvedLocation = data.sourceLocation;
  if (resolvedLocation) {
    resolvedLocation = await resolveSourceLocation(resolvedLocation);
  }

  addNode({
    id: data.computedId,
    type: 'computed',
    name: resolvedLocation?.display ?? data.name,
    contextId: event.contextId,
    sourceLocation: resolvedLocation,
    created: existingNode?.created ?? event.timestamp ?? Date.now(),
  });
}

/**
 * Handle effect events - ensure node exists with source location
 */
async function handleEffectEvent(event: RimitiveEvent): Promise<void> {
  const data = event.data as {
    effectId?: string;
    name?: string;
    sourceLocation?: SourceLocation;
  } | undefined;

  if (!data?.effectId) return;

  const state = graphState();
  const existingNode = state.nodes.get(data.effectId);

  // Only update if we don't have source location yet, or if this event has one
  if (existingNode?.sourceLocation && !data.sourceLocation) return;

  // Resolve source location if present
  let resolvedLocation = data.sourceLocation;
  if (resolvedLocation) {
    resolvedLocation = await resolveSourceLocation(resolvedLocation);
  }

  addNode({
    id: data.effectId,
    type: 'effect',
    name: resolvedLocation?.display ?? data.name,
    contextId: event.contextId,
    sourceLocation: resolvedLocation,
    created: existingNode?.created ?? event.timestamp ?? Date.now(),
  });
}

/**
 * Handle dependency:tracked event - create edge between producer and consumer
 */
function handleDependencyTracked(event: RimitiveEvent): void {
  const data = event.data as {
    producerId?: string;
    consumerId?: string;
  } | undefined;

  if (!data?.producerId || !data?.consumerId) return;

  const timestamp = event.timestamp ?? Date.now();

  // Ensure both nodes exist (with minimal info if we haven't seen them yet)
  ensureNodeExists(data.producerId, event.contextId, timestamp);
  ensureNodeExists(data.consumerId, event.contextId, timestamp);

  // Add the edge
  addEdge({
    id: `${data.consumerId}->${data.producerId}`,
    producerId: data.producerId,
    consumerId: data.consumerId,
    tracked: timestamp,
  });
}

/**
 * Handle dependency:pruned event - remove edge between producer and consumer
 */
function handleDependencyPruned(event: RimitiveEvent): void {
  const data = event.data as {
    producerId?: string;
    consumerId?: string;
  } | undefined;

  if (!data?.producerId || !data?.consumerId) return;

  removeEdge(data.consumerId, data.producerId);
}

/**
 * Handle effect:dispose event - could remove the node
 */
function handleEffectDispose(): void {
  // For now, we keep disposed nodes in the graph
  // They'll just have no edges
  // Could optionally remove them: removeNode(data.effectId)
}

/**
 * Ensure a node exists in the graph (with minimal info if we haven't seen full event yet)
 */
function ensureNodeExists(nodeId: string, contextId: string, timestamp: number): void {
  const state = graphState();
  if (state.nodes.has(nodeId)) return;

  // Infer type from ID prefix if possible
  let type: GraphNodeType = 'signal';
  if (nodeId.includes('computed') || nodeId.includes('Computed')) {
    type = 'computed';
  } else if (nodeId.includes('effect') || nodeId.includes('Effect')) {
    type = 'effect';
  }

  addNode({
    id: nodeId,
    type,
    name: undefined,
    contextId,
    sourceLocation: undefined,
    created: timestamp,
  });
}

/**
 * Handle graph:snapshot event - merge snapshot data for this context into graph state
 */
function handleGraphSnapshot(event: RimitiveEvent): void {
  const data = event.data as GraphSnapshot | undefined;
  if (!data) return;

  const timestamp = event.timestamp ?? Date.now();
  const contextId = event.contextId;
  const currentState = graphState();

  // Start with existing state, removing nodes/edges from this context
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  // Copy nodes from other contexts
  for (const [id, node] of currentState.nodes) {
    if (node.contextId !== contextId) {
      nodes.set(id, node);
    }
  }

  // Copy edges where both nodes are from other contexts
  for (const [id, edge] of currentState.edges) {
    const producerNode = currentState.nodes.get(edge.producerId);
    const consumerNode = currentState.nodes.get(edge.consumerId);
    if (producerNode?.contextId !== contextId && consumerNode?.contextId !== contextId) {
      edges.set(id, edge);
    }
  }

  // Rebuild dependencies/dependents from remaining edges
  for (const edge of edges.values()) {
    // Add to consumer's dependencies
    let deps = dependencies.get(edge.consumerId);
    if (!deps) {
      deps = new Set();
      dependencies.set(edge.consumerId, deps);
    }
    deps.add(edge.producerId);

    // Add to producer's dependents
    let depnts = dependents.get(edge.producerId);
    if (!depnts) {
      depnts = new Set();
      dependents.set(edge.producerId, depnts);
    }
    depnts.add(edge.consumerId);
  }

  // Add nodes from this context's snapshot
  for (const node of data.nodes) {
    nodes.set(node.id, {
      id: node.id,
      type: node.type,
      name: node.name,
      contextId,
      sourceLocation: node.sourceLocation,
      created: timestamp,
    });
  }

  // Add edges from this context's snapshot
  for (const edge of data.edges) {
    const edgeId = `${edge.consumerId}->${edge.producerId}`;
    edges.set(edgeId, {
      id: edgeId,
      producerId: edge.producerId,
      consumerId: edge.consumerId,
      tracked: timestamp,
    });

    // Add to consumer's dependencies
    let deps = dependencies.get(edge.consumerId);
    if (!deps) {
      deps = new Set();
      dependencies.set(edge.consumerId, deps);
    }
    deps.add(edge.producerId);

    // Add to producer's dependents
    let depnts = dependents.get(edge.producerId);
    if (!depnts) {
      depnts = new Set();
      dependents.set(edge.producerId, depnts);
    }
    depnts.add(edge.consumerId);
  }

  // Update state atomically
  graphState({ nodes, edges, dependencies, dependents });

  // Clear selection if the selected node no longer exists
  const selected = selectedNodeId();
  if (selected && !nodes.has(selected)) {
    selectedNodeId(null);
  }
}
