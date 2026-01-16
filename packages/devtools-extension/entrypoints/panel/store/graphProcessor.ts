import type { RimitiveEvent } from './messageHandler';
import type { GraphNode, GraphEdge, GraphNodeType } from './graphTypes';
import type { SourceLocation } from './types';
import { graphState, addNode, addEdge, removeEdge, removeNode } from './graphState';

/**
 * Process graph-related events to maintain dependency graph state
 */
export function processGraphEvent(event: RimitiveEvent): void {
  switch (event.type) {
    case 'dependency:tracked':
      handleDependencyTracked(event);
      break;

    case 'dependency:pruned':
      handleDependencyPruned(event);
      break;

    case 'effect:dispose':
      handleNodeDisposed(event);
      break;

    // Handle signal/computed/effect events to register nodes
    case 'signal:read':
    case 'signal:write':
      ensureNodeExists(event, 'signal', 'signalId');
      break;

    case 'computed:read':
    case 'computed:value':
      ensureNodeExists(event, 'computed', 'computedId');
      break;

    case 'effect:run':
      ensureNodeExists(event, 'effect', 'effectId');
      break;
  }
}

/**
 * Ensure a node exists in the graph, creating it if necessary
 */
function ensureNodeExists(
  event: RimitiveEvent,
  type: GraphNodeType,
  idField: string
): void {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return;

  const nodeId = data[idField];
  if (typeof nodeId !== 'string') return;

  // Check if node already exists
  const state = graphState();
  if (state.nodes.has(nodeId)) return;

  // Create new node
  const node: GraphNode = {
    id: nodeId,
    type,
    name: extractNodeName(data),
    contextId: event.contextId,
    sourceLocation: extractSourceLocation(data),
    created: event.timestamp ?? Date.now(),
  };

  addNode(node);
}

/**
 * Handle dependency:tracked event
 */
function handleDependencyTracked(event: RimitiveEvent): void {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return;

  const producerId = data.producerId;
  const consumerId = data.consumerId;

  if (typeof producerId !== 'string' || typeof consumerId !== 'string') return;

  const edge: GraphEdge = {
    id: `${consumerId}->${producerId}`,
    consumerId,
    producerId,
    tracked: event.timestamp ?? Date.now(),
  };

  addEdge(edge);
}

/**
 * Handle dependency:pruned event
 */
function handleDependencyPruned(event: RimitiveEvent): void {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return;

  const producerId = data.producerId;
  const consumerId = data.consumerId;

  if (typeof producerId !== 'string' || typeof consumerId !== 'string') return;

  removeEdge(consumerId, producerId);
}

/**
 * Handle node disposal events
 */
function handleNodeDisposed(event: RimitiveEvent): void {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return;

  const nodeId = extractNodeId(data);
  if (!nodeId) return;

  removeNode(nodeId);
}

/**
 * Extract node ID from event data
 */
function extractNodeId(data: Record<string, unknown>): string | undefined {
  if ('signalId' in data && typeof data.signalId === 'string')
    return data.signalId;
  if ('computedId' in data && typeof data.computedId === 'string')
    return data.computedId;
  if ('effectId' in data && typeof data.effectId === 'string')
    return data.effectId;
  if ('id' in data && typeof data.id === 'string') return data.id;
  if ('nodeId' in data && typeof data.nodeId === 'string') return data.nodeId;
  return undefined;
}

/**
 * Extract node name from data
 */
function extractNodeName(data: Record<string, unknown>): string | undefined {
  if ('name' in data && typeof data.name === 'string') return data.name;
  if ('label' in data && typeof data.label === 'string') return data.label;
  return undefined;
}

/**
 * Extract source location from event data
 */
function extractSourceLocation(
  data: Record<string, unknown>
): SourceLocation | undefined {
  const loc = data.sourceLocation;

  if (!loc || typeof loc !== 'object') {
    return undefined;
  }

  const location = loc as Record<string, unknown>;
  if (
    typeof location.display === 'string' &&
    typeof location.filePath === 'string' &&
    typeof location.line === 'number'
  ) {
    return {
      display: location.display,
      filePath: location.filePath,
      line: location.line,
      column: typeof location.column === 'number' ? location.column : undefined,
    };
  }

  return undefined;
}
