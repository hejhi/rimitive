import { devtoolsContext, devtoolsStore } from './devtoolsCtx';
import { SignalReadData } from './types';

// Actual computed values that transform or aggregate data
export const filteredTransactions = devtoolsContext.computed(() => {
  const transactions = devtoolsStore.state.transactions.value;
  const filter = devtoolsStore.state.filter.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;

  let filtered = transactions;

  // Filter by selected context
  if (selectedContext) {
    filtered = filtered.filter((t) => t.contextId === selectedContext);
  }

  // Filter by type
  if (filter.type !== 'all') {
    filtered = filtered.filter((t) => t.type === filter.type);
  }

  // Filter by search
  if (filter.search) {
    const search = filter.search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.eventType.toLowerCase().includes(search) ||
        JSON.stringify(t.data).toLowerCase().includes(search)
    );
  }

  // Filter internal reads if enabled
  if (filter.hideInternal) {
    filtered = filtered.filter((t) => {
      if (t.eventType !== 'SIGNAL_READ') return true;
      const data = t.data as SignalReadData;
      return !data.internal;
    });
  }

  filtered = filtered.filter(
    (t) => t
    // t.eventType !== 'EFFECT_START' &&
    // t.eventType !== 'EFFECT_END' &&
    // t.eventType !== 'COMPUTED_START' &&
    // t.eventType !== 'BATCH_START' &&
    // t.eventType !== 'BATCH_END' &&
    // t.eventType !== 'DEPENDENCY_UPDATE'
  );

  return filtered;
});

export const selectedContextData = devtoolsContext.computed(() => {
  const selectedId = devtoolsStore.state.selectedContext.value;
  if (!selectedId) return null;

  return devtoolsStore.state.contexts.value.find((c) => c.id === selectedId);
});

export const stats = devtoolsContext.computed(() => {
  const contexts = devtoolsStore.state.contexts.value;
  const graph = devtoolsStore.state.dependencyGraph.value;

  return {
    totalSignals: contexts.reduce((sum, c) => sum + c.signalCount, 0),
    totalComputeds: contexts.reduce((sum, c) => sum + c.computedCount, 0),
    totalEffects: contexts.reduce((sum, c) => sum + c.effectCount, 0),
    totalTransactions: devtoolsStore.state.transactions.value.length,
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
  
  return filteredTransactions.value.find(t => t.id === selectedId) || null;
});

export const filteredLogEntries = devtoolsContext.computed(() => {
  const logs = devtoolsStore.state.logEntries.value;
  const filter = devtoolsStore.state.filter.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;

  let filtered = logs;

  // Filter by selected context
  if (selectedContext) {
    filtered = filtered.filter((log) => log.contextId === selectedContext);
  }

  // Filter by type
  if (filter.type !== 'all') {
    filtered = filtered.filter((log) => {
      const nodeType = log.type.split('-')[0]; // 'signal-write' -> 'signal'
      return nodeType === filter.type;
    });
  }

  // Filter by search
  if (filter.search) {
    const search = filter.search.toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.nodeName?.toLowerCase().includes(search) ||
        log.nodeId.toLowerCase().includes(search) ||
        JSON.stringify(log.details).toLowerCase().includes(search)
    );
  }

  // Keep last 500 logs
  return filtered.slice(-500);
});

export const dependencyGraphData = devtoolsContext.computed(() => {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;
  const filter = devtoolsStore.state.filter.value;

  let nodes = Array.from(graph.nodes.values());

  // Filter by context if needed
  if (selectedContext) {
    nodes = nodes.filter((node) => node.id.startsWith(selectedContext));
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

