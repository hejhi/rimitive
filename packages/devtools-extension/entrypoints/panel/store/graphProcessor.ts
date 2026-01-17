import type { RimitiveEvent } from './messageHandler';
import type { GraphNode, GraphEdge } from './graphTypes';
import type { SourceLocation } from './types';
import { graphState, selectedNodeId } from './graphState';

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
  if (event.type === 'graph:snapshot') {
    handleGraphSnapshot(event);
  }
}

/**
 * Handle graph:snapshot event - replace entire graph state with snapshot
 */
function handleGraphSnapshot(event: RimitiveEvent): void {
  const data = event.data as GraphSnapshot | undefined;
  if (!data) return;

  const timestamp = event.timestamp ?? Date.now();

  // Build nodes map
  const nodes = new Map<string, GraphNode>();
  for (const node of data.nodes) {
    nodes.set(node.id, {
      id: node.id,
      type: node.type,
      name: node.name,
      contextId: event.contextId,
      sourceLocation: node.sourceLocation,
      created: timestamp,
    });
  }

  // Build edges map and adjacency lists
  const edges = new Map<string, GraphEdge>();
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

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
