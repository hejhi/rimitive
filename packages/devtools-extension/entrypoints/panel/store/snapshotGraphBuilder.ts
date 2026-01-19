import type { LogEntry } from './types';
import type { GraphState, GraphNode, GraphEdge, GraphNodeType } from './graphTypes';

/**
 * Build a GraphState from log entries
 * This is used for snapshot mode where we don't have the live graph state
 */
export function buildGraphStateFromLogEntries(entries: LogEntry[]): GraphState {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const entry of entries) {
    // Extract node from signal/computed/effect events
    if (entry.nodeId) {
      const nodeType = inferNodeType(entry.eventType);
      const existing = nodes.get(entry.nodeId);

      // Only add/update if we don't have the node or the new entry has more info
      if (!existing || (entry.sourceLocation && !existing.sourceLocation)) {
        nodes.set(entry.nodeId, {
          id: entry.nodeId,
          type: nodeType,
          name: entry.nodeName,
          contextId: entry.contextId,
          sourceLocation: entry.sourceLocation,
          created: entry.timestamp,
        });
      }
    }

    // Extract edges from dependency:tracked events
    if (entry.eventType === 'dependency:tracked') {
      const data = entry.data as { producerId?: string; consumerId?: string } | undefined;
      if (data?.producerId && data?.consumerId) {
        const edgeId = `${data.consumerId}->${data.producerId}`;

        // Skip if edge already exists
        if (!edges.has(edgeId)) {
          edges.set(edgeId, {
            id: edgeId,
            producerId: data.producerId,
            consumerId: data.consumerId,
            tracked: entry.timestamp,
          });

          // Add to consumer's dependencies
          let deps = dependencies.get(data.consumerId);
          if (!deps) {
            deps = new Set();
            dependencies.set(data.consumerId, deps);
          }
          deps.add(data.producerId);

          // Add to producer's dependents
          let depnts = dependents.get(data.producerId);
          if (!depnts) {
            depnts = new Set();
            dependents.set(data.producerId, depnts);
          }
          depnts.add(data.consumerId);

          // Ensure both nodes exist
          ensureNodeExists(nodes, data.producerId, entry.contextId, entry.timestamp);
          ensureNodeExists(nodes, data.consumerId, entry.contextId, entry.timestamp);
        }
      }
    }

    // Handle dependency:pruned events
    if (entry.eventType === 'dependency:pruned') {
      const data = entry.data as { producerId?: string; consumerId?: string } | undefined;
      if (data?.producerId && data?.consumerId) {
        const edgeId = `${data.consumerId}->${data.producerId}`;

        // Remove edge
        edges.delete(edgeId);

        // Remove from dependencies
        const deps = dependencies.get(data.consumerId);
        if (deps) {
          deps.delete(data.producerId);
          if (deps.size === 0) {
            dependencies.delete(data.consumerId);
          }
        }

        // Remove from dependents
        const depnts = dependents.get(data.producerId);
        if (depnts) {
          depnts.delete(data.consumerId);
          if (depnts.size === 0) {
            dependents.delete(data.producerId);
          }
        }
      }
    }
  }

  return { nodes, edges, dependencies, dependents };
}

/**
 * Infer node type from event type
 */
function inferNodeType(eventType: string): GraphNodeType {
  if (eventType.includes('signal')) return 'signal';
  if (eventType.includes('computed')) return 'computed';
  if (eventType.includes('effect')) return 'effect';
  if (eventType.includes('subscribe')) return 'subscribe';
  return 'signal'; // Default
}

/**
 * Ensure a node exists in the map with minimal info
 */
function ensureNodeExists(
  nodes: Map<string, GraphNode>,
  nodeId: string,
  contextId: string,
  timestamp: number
): void {
  if (nodes.has(nodeId)) return;

  // Infer type from ID prefix if possible
  let type: GraphNodeType = 'signal';
  if (nodeId.includes('computed') || nodeId.includes('Computed')) {
    type = 'computed';
  } else if (nodeId.includes('effect') || nodeId.includes('Effect')) {
    type = 'effect';
  }

  nodes.set(nodeId, {
    id: nodeId,
    type,
    name: undefined,
    contextId,
    sourceLocation: undefined,
    created: timestamp,
  });
}
