import type { InstrumentationContext, SourceLocation } from '@rimitive/core';

/**
 * Node type for graph visualization
 */
export type GraphNodeType = 'signal' | 'computed' | 'effect';

/**
 * Node metadata for graph visualization
 */
export type GraphNodeMeta = {
  id: string;
  type: GraphNodeType;
  name: string;
  sourceLocation?: SourceLocation;
};

/**
 * Graph snapshot for devtools
 */
export type GraphSnapshot = {
  nodes: GraphNodeMeta[];
  edges: Array<{ producerId: string; consumerId: string }>;
};

/**
 * Signals-specific instrumentation state.
 * Shared between signal/computed/effect/graphEdges instrument hooks.
 * @internal
 */
export type SignalsInstrState = {
  /** Map reactive nodes to their instrumentation IDs */
  nodeIds: WeakMap<object, string>;
  /** Stack of pending producer IDs for dependency tracking */
  pendingProducerIdStack: string[];
  /** Node metadata for graph visualization */
  nodeMeta: Map<string, GraphNodeMeta>;
  /** Current edges: Set of "consumerId->producerId" strings */
  edges: Set<string>;
  /** Pending snapshot emission (debounced) */
  snapshotPending: boolean;
};

/** Symbol key for storing signals state on the context object */
const SIGNALS_STATE = Symbol('signals-instr-state');

/** Context with signals state attached */
type ContextWithState = InstrumentationContext & {
  [SIGNALS_STATE]?: SignalsInstrState;
};

/**
 * Get or create the signals instrumentation state for a context.
 * Stores state directly on the context object using a symbol key.
 * Called by signal/computed/effect/graphEdges instrument hooks.
 */
export function getInstrState(instr: InstrumentationContext): SignalsInstrState {
  const ctx = instr as ContextWithState;

  if (!ctx[SIGNALS_STATE]) {
    ctx[SIGNALS_STATE] = {
      nodeIds: new WeakMap(),
      pendingProducerIdStack: [],
      nodeMeta: new Map(),
      edges: new Set(),
      snapshotPending: false,
    };
  }

  return ctx[SIGNALS_STATE];
}

/**
 * Register a node's metadata for graph visualization
 */
export function registerNodeMeta(
  state: SignalsInstrState,
  id: string,
  type: GraphNodeType,
  name: string,
  sourceLocation?: SourceLocation
): void {
  state.nodeMeta.set(id, { id, type, name, sourceLocation });
}

/**
 * Remove a node's metadata (on dispose)
 * Also removes orphaned nodes that were only connected to this node
 */
export function removeNodeMeta(state: SignalsInstrState, id: string): void {
  if (!state.nodeMeta.has(id)) return;

  state.nodeMeta.delete(id);

  // Collect edges to remove and nodes that were connected
  const edgesToRemove: string[] = [];
  const connectedNodes = new Set<string>();

  for (const edge of state.edges) {
    const arrowIndex = edge.indexOf('->');
    if (arrowIndex === -1) continue;

    const consumerId = edge.slice(0, arrowIndex);
    const producerId = edge.slice(arrowIndex + 2);

    if (consumerId === id) {
      // This node was a consumer of producerId
      edgesToRemove.push(edge);
      connectedNodes.add(producerId);
    } else if (producerId === id) {
      // consumerId was a consumer of this node
      edgesToRemove.push(edge);
      connectedNodes.add(consumerId);
    }
  }

  // Remove edges (after iteration is complete)
  for (const edge of edgesToRemove) {
    state.edges.delete(edge);
  }

  // Check if any connected nodes are now orphaned (no remaining edges)
  for (const nodeId of connectedNodes) {
    if (isOrphaned(state, nodeId)) {
      // Recursively remove orphaned node
      removeNodeMeta(state, nodeId);
    }
  }
}

/**
 * Check if a node should be removed
 * - Truly orphaned (no edges at all)
 * - OR a computed with no dependents (nothing reads it = dead)
 */
function isOrphaned(state: SignalsInstrState, nodeId: string): boolean {
  const node = state.nodeMeta.get(nodeId);
  if (!node) return true;

  let hasDependents = false;
  let hasDependencies = false;

  for (const edge of state.edges) {
    const arrowIndex = edge.indexOf('->');
    if (arrowIndex === -1) continue;

    const consumerId = edge.slice(0, arrowIndex);
    const producerId = edge.slice(arrowIndex + 2);

    if (producerId === nodeId) {
      // Something depends on this node
      hasDependents = true;
    }
    if (consumerId === nodeId) {
      // This node depends on something
      hasDependencies = true;
    }

    // Early exit if we found both
    if (hasDependents && hasDependencies) {
      return false;
    }
  }

  // Truly orphaned - no edges at all
  if (!hasDependents && !hasDependencies) {
    return true;
  }

  // Computed with no dependents is dead (nothing reads it)
  // Signals might still be "live" even with no dependents (app holds reference)
  if (node.type === 'computed' && !hasDependents) {
    return true;
  }

  return false;
}

/**
 * Build a snapshot of the current graph state
 */
export function buildGraphSnapshot(state: SignalsInstrState): GraphSnapshot {
  const nodes = Array.from(state.nodeMeta.values());
  const edges: GraphSnapshot['edges'] = [];

  for (const edge of state.edges) {
    const arrowIndex = edge.indexOf('->');
    if (arrowIndex === -1) continue;
    const consumerId = edge.slice(0, arrowIndex);
    const producerId = edge.slice(arrowIndex + 2);
    edges.push({ producerId, consumerId });
  }

  return { nodes, edges };
}

/**
 * Schedule a snapshot emission (debounced to batch rapid changes)
 */
export function scheduleSnapshot(
  state: SignalsInstrState,
  instr: InstrumentationContext
): void {
  if (state.snapshotPending) return;
  state.snapshotPending = true;

  // Use microtask to batch changes within the same tick
  queueMicrotask(() => {
    state.snapshotPending = false;
    instr.emit({
      type: 'graph:snapshot',
      timestamp: Date.now(),
      data: buildGraphSnapshot(state),
    });
  });
}
