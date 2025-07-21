import { devtoolsStore } from './devtoolsCtx';
import {
  DependencyUpdateData,
  GraphSnapshotData,
  DependencyNode,
} from './types';

// Batch updates to avoid multiple re-renders
let updateBatch: (() => void)[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

export function scheduleBatchUpdate(updateFn: () => void) {
  updateBatch.push(updateFn);

  if (batchTimeout) return;

  batchTimeout = setTimeout(() => {
    const graph = devtoolsStore.state.dependencyGraph.value;

    // Execute all batched updates
    updateBatch.forEach((fn) => fn());
    updateBatch = [];
    batchTimeout = null;

    // Single re-render
    devtoolsStore.state.dependencyGraph.value = { ...graph };
  }, 0);
}

export function addNodeToGraph(
  id: string,
  nodeData: {
    type: DependencyNode['type'];
    name?: string;
    value?: unknown;
    contextId?: string;
  }
) {
  scheduleBatchUpdate(() => {
    const graph = devtoolsStore.state.dependencyGraph.value;

    graph.nodes.set(id, {
      id,
      type: nodeData.type,
      name: nodeData.name,
      value: nodeData.value,
      isActive: true,
      isOutdated: false,
      hasSubscribers: false,
      contextId: nodeData.contextId,
    });
  });
}

export function updateDependencyGraph(
  data: DependencyUpdateData,
  contextId: string
) {
  scheduleBatchUpdate(() => {
    const graph = devtoolsStore.state.dependencyGraph.value;
    const subLen = data.subscribers?.length ?? 0;
    // Update node - preserve existing name if available
    const existingNode = graph.nodes.get(data.id);
    if (existingNode) {
      // Update existing node
      existingNode.value = data.value;
      existingNode.hasSubscribers = subLen > 0;
      // Update context ID if not already set
      if (!existingNode.contextId) {
        existingNode.contextId = contextId;
      }
    } else {
      // Create new node if it doesn't exist
      graph.nodes.set(data.id, {
        id: data.id,
        type: data.type || 'unknown',
        name: undefined,
        value: data.value,
        isActive: true,
        isOutdated: false,
        hasSubscribers: subLen > 0,
        contextId,
      });
    }

    // Clear existing edges for this node
    graph.edges.delete(data.id);
    graph.reverseEdges.delete(data.id);

    // Batch edge updates - pre-allocate sets when possible
    if (data.dependencies?.length) {
      for (const dep of data.dependencies) {
        let edgeSet = graph.edges.get(dep.id);
        if (!edgeSet) {
          edgeSet = new Set();
          graph.edges.set(dep.id, edgeSet);
        }
        edgeSet.add(data.id);
      }
    }

    // Batch reverse edge updates
    if (data.subscribers?.length) {
      let reverseEdgeSet = graph.reverseEdges.get(data.id);
      if (!reverseEdgeSet) {
        reverseEdgeSet = new Set();
        graph.reverseEdges.set(data.id, reverseEdgeSet);
      }
      for (const sub of data.subscribers) {
        reverseEdgeSet.add(sub.id);
      }
    }
  });
}

export function updateGraphSnapshot(
  data: GraphSnapshotData,
  timestamp: number,
  contextId: string
) {
  scheduleBatchUpdate(() => {
    const graph = devtoolsStore.state.dependencyGraph.value;

    // Collect nodes to remove in a single pass
    const nodesToRemove: string[] = [];
    for (const [id, node] of graph.nodes) {
      if (node.contextId === contextId) {
        nodesToRemove.push(id);
      }
    }

    // Batch remove nodes and their edges
    for (const id of nodesToRemove) {
      graph.nodes.delete(id);
      graph.edges.delete(id);
      graph.reverseEdges.delete(id);
    }

    // Optimize edge cleanup with early exit
    if (nodesToRemove.length > 0) {
      const removeSet = new Set(nodesToRemove);

      // Clean edges in a single pass per map
      for (const [, targets] of graph.edges) {
        if (targets.size === 0) continue;
        for (const removedId of removeSet) {
          targets.delete(removedId);
        }
      }

      for (const [, sources] of graph.reverseEdges) {
        if (sources.size === 0) continue;
        for (const removedId of removeSet) {
          sources.delete(removedId);
        }
      }
    }

    // Batch add nodes
    for (const node of data.nodes) {
      graph.nodes.set(node.id, {
        ...node,
        contextId: node.contextId || contextId,
      });
    }

    // Pre-group edges by source/target for batch processing
    const edgesBySource = new Map<string, string[]>();
    const edgesByTarget = new Map<string, string[]>();

    for (const edge of data.edges) {
      if (!edgesBySource.has(edge.source)) {
        edgesBySource.set(edge.source, []);
      }
      edgesBySource.get(edge.source)!.push(edge.target);

      if (!edgesByTarget.has(edge.target)) {
        edgesByTarget.set(edge.target, []);
      }
      edgesByTarget.get(edge.target)!.push(edge.source);
    }

    // Batch add edges
    for (const [source, targets] of edgesBySource) {
      const edgeSet = new Set(targets);
      graph.edges.set(source, edgeSet);
    }

    for (const [target, sources] of edgesByTarget) {
      const reverseEdgeSet = new Set(sources);
      graph.reverseEdges.set(target, reverseEdgeSet);
    }

    // Update last snapshot
    devtoolsStore.state.lastSnapshot.value = {
      timestamp,
      nodes: data.nodes,
      edges: data.edges,
    };
  });
}
