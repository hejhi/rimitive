import { devtoolsContext, devtoolsStore } from './devtoolsCtx';

// Common log filtering logic
function filterLogs(
  logs: typeof devtoolsStore.state.logEntries.value,
  filter: typeof devtoolsStore.state.filter.value,
  selectedContext: string | null,
  searchIn: string[]
) {
  return logs.filter((log) => {
    // Context filter
    if (selectedContext && log.contextId !== selectedContext) return false;

    // Type filter
    if (filter.type !== 'all' && log.category !== filter.type) return false;

    // Search filter
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const searchTargets = searchIn.map((field) => {
        if (field === 'eventType') return log.eventType;
        if (field === 'nodeName') return log.nodeName || '';
        if (field === 'nodeId') return log.nodeId || '';
        if (field === 'data') return JSON.stringify(log.data);
        if (field === 'summary') return log.summary || '';
        return '';
      });

      if (
        !searchTargets.some((target) => target.toLowerCase().includes(search))
      ) {
        return false;
      }
    }

    // Internal reads filter
    if (filter.hideInternal && log.eventType === 'SIGNAL_READ') {
      const data = log.data;
      return !data.internal;
    }

    return true;
  });
}

// Actual computed values that transform or aggregate data
export const filteredTransactions = devtoolsContext.computed(() => {
  const logEntries = devtoolsStore.state.logEntries.value;
  const filter = devtoolsStore.state.filter.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;

  const filtered = filterLogs(logEntries, filter, selectedContext, [
    'eventType',
    'nodeName',
    'data',
  ]);

  // Timeline view filters - show only main events, not start/end pairs
  return filtered.filter(
    (log) =>
      !log.eventType.includes('_START') &&
      !log.eventType.includes('_BEGIN') &&
      log.eventType !== 'DEPENDENCY_UPDATE' &&
      log.eventType !== 'GRAPH_SNAPSHOT'
  );
});

export const selectedContextData = devtoolsContext.computed(() => {
  const selectedId = devtoolsStore.state.selectedContext.value;
  if (!selectedId) return null;

  return devtoolsStore.state.contexts.value.find((c) => c.id === selectedId);
});

export const stats = devtoolsContext.computed(() => {
  const contexts = devtoolsStore.state.contexts.value;
  const graph = devtoolsStore.state.dependencyGraph.value;

  // Aggregate resource counts across all contexts
  const resourceTotals: Record<string, number> = {};
  for (const context of contexts) {
    if (context.resourceCounts) {
      for (const [type, count] of Object.entries(context.resourceCounts)) {
        resourceTotals[type] = (resourceTotals[type] || 0) + count;
      }
    }
  }

  return {
    resourceCounts: resourceTotals,
    totalTransactions: devtoolsStore.state.logEntries.value.length,
    totalNodes: graph.nodes.size,
    totalEdges: Array.from(graph.edges.values()).reduce(
      (sum, deps) => sum + deps.size,
      0
    ),
  };
});

// Selected item data
export const selectedTransactionData = devtoolsContext.computed(() => {
  const selectedId = devtoolsStore.state.selectedTransaction.value;
  if (!selectedId) return null;

  return (
    filteredTransactions.value.find((log) => log.id === selectedId) || null
  );
});

export const filteredLogEntries = devtoolsContext.computed(() => {
  const logs = devtoolsStore.state.logEntries.value;
  const filter = devtoolsStore.state.filter.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;

  const filtered = filterLogs(logs, filter, selectedContext, [
    'nodeName',
    'nodeId',
    'data',
    'summary',
  ]);
  return filtered.slice(-500); // Keep last 500 logs
});

export const dependencyGraphData = devtoolsContext.computed(() => {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;
  const filter = devtoolsStore.state.filter.value;

  let nodes = Array.from(graph.nodes.values());

  // Filter by context if needed
  if (selectedContext) {
    nodes = nodes.filter((node) => node.contextId === selectedContext);
  }

  // Filter by type
  if (filter.type !== 'all') {
    nodes = nodes.filter((node) => node.type === filter.type);
  }

  // Filter by search
  if (filter.search) {
    const search = filter.search.toLowerCase();
    nodes = nodes.filter(
      (node) =>
        node.name?.toLowerCase().includes(search) ||
        node.id.toLowerCase().includes(search) ||
        JSON.stringify(node.value).toLowerCase().includes(search)
    );
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges = Array.from(graph.edges.entries())
    .filter(([source]) => nodeIds.has(source))
    .flatMap(([source, targets]) =>
      Array.from(targets)
        .filter((target) => nodeIds.has(target))
        .map((target) => ({
          source,
          target,
          isActive: true,
        }))
    );

  return {
    nodes,
    edges,
  };
});

export const nodeDependencies = devtoolsContext.computed(() => {
  const graph = devtoolsStore.state.dependencyGraph.value;

  return (nodeId: string) => {
    // Find nodes that this node depends on (nodes that have edges TO this node)
    const dependencies: string[] = [];
    graph.edges.forEach((targets, source) => {
      if (targets.has(nodeId)) {
        dependencies.push(source);
      }
    });

    // Find nodes that depend on this node (this node has edges TO them)
    const subscribers = graph.edges.get(nodeId) || new Set();

    return {
      dependencies: dependencies.map((id) => ({
        id,
        node: graph.nodes.get(id),
      })),
      subscribers: Array.from(subscribers).map((id) => ({
        id,
        node: graph.nodes.get(id),
      })),
    };
  };
});
