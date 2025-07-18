import { devtoolsStore } from '../devtoolsCtx';
import { DependencyUpdateData, GraphSnapshotData, DependencyNode } from '../types';

export function addNodeToGraph(
  id: string,
  nodeData: { type: DependencyNode['type']; name?: string; value?: unknown; contextId?: string }
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

export function updateDependencyGraph(data: DependencyUpdateData, contextId: string) {
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
  data.dependencies.forEach((dep) => {
    if (!graph.edges.has(dep.id)) {
      graph.edges.set(dep.id, new Set());
    }
    graph.edges.get(dep.id)!.add(data.id);
  });

  // Update reverse edges: this node has edges TO each subscriber
  data.subscribers.forEach((sub) => {
    if (!graph.reverseEdges.has(data.id)) {
      graph.reverseEdges.set(data.id, new Set());
    }
    graph.reverseEdges.get(data.id)!.add(sub.id);
  });

  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}

export function updateGraphSnapshot(data: GraphSnapshotData, timestamp: number) {
  const graph = devtoolsStore.state.dependencyGraph.value;

  // Clear and rebuild graph from snapshot
  graph.nodes.clear();
  graph.edges.clear();
  graph.reverseEdges.clear();

  // Add all nodes
  data.nodes.forEach((node) => {
    graph.nodes.set(node.id, node);
  });

  // Add all edges
  data.edges.forEach((edge) => {
    if (!graph.edges.has(edge.source)) {
      graph.edges.set(edge.source, new Set());
    }
    graph.edges.get(edge.source)!.add(edge.target);

    if (!graph.reverseEdges.has(edge.target)) {
      graph.reverseEdges.set(edge.target, new Set());
    }
    graph.reverseEdges.get(edge.target)!.add(edge.source);
  });

  // Update last snapshot
  devtoolsStore.state.lastSnapshot.value = {
    timestamp,
    nodes: data.nodes,
    edges: data.edges,
  };

  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}