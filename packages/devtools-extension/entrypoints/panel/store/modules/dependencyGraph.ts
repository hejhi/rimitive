import { devtoolsStore } from '../devtoolsCtx';
import {
  DependencyUpdateData,
  GraphSnapshotData,
  DependencyNode,
} from '../types';

export function addNodeToGraph(
  id: string,
  nodeData: {
    type: DependencyNode['type'];
    name?: string;
    value?: unknown;
    contextId?: string;
  }
) {
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

  devtoolsStore.state.dependencyGraph.value = { ...graph };
}

export function updateDependencyGraph(
  data: DependencyUpdateData,
  contextId: string
) {
  const graph = devtoolsStore.state.dependencyGraph.value;

  // Update node - preserve existing name if available
  const existingNode = graph.nodes.get(data.id);
  if (existingNode) {
    // Update existing node
    existingNode.value = data.value;
    existingNode.hasSubscribers = data.subscribers.length > 0;
    // Update context ID if not already set
    if (!existingNode.contextId) {
      existingNode.contextId = contextId;
    }
  } else {
    // Create new node if it doesn't exist
    graph.nodes.set(data.id, {
      id: data.id,
      type: data.type,
      name: undefined,
      value: data.value,
      isActive: true,
      isOutdated: false,
      hasSubscribers: data.subscribers.length > 0,
      contextId,
    });
  }

  // Clear existing edges for this node
  graph.edges.delete(data.id);
  graph.reverseEdges.delete(data.id);

  // Update edges correctly: each dependency should have an edge TO this node
  for (const dep of data.dependencies) {
    if (!graph.edges.has(dep.id)) {
      graph.edges.set(dep.id, new Set());
    }
    graph.edges.get(dep.id)!.add(data.id);
  }

  // Update reverse edges: this node has edges TO each subscriber
  for (const sub of data.subscribers) {
    if (!graph.reverseEdges.has(data.id)) {
      graph.reverseEdges.set(data.id, new Set());
    }
    graph.reverseEdges.get(data.id)!.add(sub.id);
  }

  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}

export function updateGraphSnapshot(
  data: GraphSnapshotData,
  timestamp: number,
  contextId: string
) {
  const graph = devtoolsStore.state.dependencyGraph.value;

  // First, remove only nodes and edges belonging to this context
  const nodesToRemove = new Set<string>();

  graph.nodes.forEach((node, id) => {
    if (node.contextId === contextId) {
      nodesToRemove.add(id);
    }
  });

  // Remove nodes from this context
  nodesToRemove.forEach((id) => {
    graph.nodes.delete(id);
    graph.edges.delete(id);
    graph.reverseEdges.delete(id);
  });

  // Also clean up edges pointing to removed nodes
  graph.edges.forEach((targets) => {
    nodesToRemove.forEach((removedId) => {
      targets.delete(removedId);
    });
  });

  graph.reverseEdges.forEach((sources) => {
    nodesToRemove.forEach((removedId) => {
      sources.delete(removedId);
    });
  });

  // Add all nodes from the snapshot (they should all be from the same context)
  for (const node of data.nodes) {
    // Ensure the node has the correct context ID
    graph.nodes.set(node.id, {
      ...node,
      contextId: node.contextId || contextId,
    });
  }

  // Add all edges from the snapshot
  for (const edge of data.edges) {
    if (!graph.edges.has(edge.source)) {
      graph.edges.set(edge.source, new Set());
    }
    graph.edges.get(edge.source)!.add(edge.target);

    if (!graph.reverseEdges.has(edge.target)) {
      graph.reverseEdges.set(edge.target, new Set());
    }
    graph.reverseEdges.get(edge.target)!.add(edge.source);
  }

  // Update last snapshot
  devtoolsStore.state.lastSnapshot.value = {
    timestamp,
    nodes: data.nodes,
    edges: data.edges,
  };

  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}
