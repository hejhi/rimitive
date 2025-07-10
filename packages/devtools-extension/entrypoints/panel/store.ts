import { createLattice, createStore } from '@lattice/core';

// Create a Lattice context for the devtools panel itself
const devtoolsContext = createLattice();

export interface DevToolsState {
  connected: boolean;
  contexts: ContextInfo[];
  transactions: Transaction[];
  selectedContext: string | null;
  selectedTab: 'timeline' | 'graph';
  filter: {
    type: 'all' | 'signal' | 'computed' | 'effect';
    search: string;
    hideInternal: boolean;
  };
  dependencyGraph: DependencyGraph;
  lastSnapshot: GraphSnapshot | null;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>; // source -> targets
  reverseEdges: Map<string, Set<string>>; // target -> sources
}

export interface DependencyNode {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  name?: string;
  value?: unknown;
  isActive: boolean;
  isOutdated?: boolean;
  hasSubscribers?: boolean;
}

export interface GraphSnapshot {
  timestamp: number;
  nodes: DependencyNode[];
  edges: Array<{ source: string; target: string; isActive: boolean }>;
}

export interface ContextInfo {
  id: string;
  name: string;
  signalCount: number;
  computedCount: number;
  effectCount: number;
  signals: SignalInfo[];
  computeds: ComputedInfo[];
  effects: EffectInfo[];
}

export interface SignalInfo {
  id: string;
  name?: string;
  value: unknown;
  lastUpdated: number;
}

export interface ComputedInfo {
  id: string;
  name?: string;
  value: unknown;
  dependencies: string[];
  lastComputed: number;
  executionContext?: string | null;
}

export interface EffectInfo {
  id: string;
  name?: string;
  isActive: boolean;
  lastRun: number;
}

// Transaction data types
export interface SignalReadData {
  id: string;
  name?: string;
  value: unknown;
  internal?: string;
  executionContext?: string | null;
  readContext?: {
    type: string;
    id: string;
    name?: string;
  };
}

export interface SignalWriteData {
  id: string;
  name?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SignalCreatedData {
  id: string;
  name?: string;
  initialValue: unknown;
}

export interface NamedItemData {
  id: string;
  name?: string;
}

export interface DependencyUpdateData {
  id: string;
  type: 'signal' | 'computed' | 'effect';
  trigger: 'created' | 'updated' | 'executed';
  dependencies: Array<{ id: string; name?: string }>;
  subscribers: Array<{ id: string; name?: string }>;
  value?: unknown;
}

export interface GraphSnapshotData {
  nodes: Array<{
    id: string;
    type: 'signal' | 'computed' | 'effect';
    name?: string;
    value?: unknown;
    isActive: boolean;
    isOutdated?: boolean;
    hasSubscribers?: boolean;
  }>;
  edges: Array<{
    source: string;
    target: string;
    isActive: boolean;
  }>;
}

export type TransactionData =
  | SignalReadData
  | SignalWriteData
  | SignalCreatedData
  | NamedItemData
  | DependencyUpdateData
  | GraphSnapshotData;

export interface Transaction {
  id: string;
  timestamp: number;
  contextId: string;
  type: 'signal' | 'computed' | 'effect' | 'batch';
  eventType: string;
  data: TransactionData;
}

// Create the devtools store
export const devtoolsStore = createStore<DevToolsState>(
  {
    connected: false,
    contexts: [],
    transactions: [],
    selectedContext: null,
    selectedTab: 'timeline',
    filter: {
      type: 'all',
      search: '',
      hideInternal: true,
    },
    dependencyGraph: {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
    },
    lastSnapshot: null,
  },
  devtoolsContext
);

// Computed values
export const filteredTransactions = devtoolsContext.computed(() => {
  const transactions = devtoolsStore.state.transactions.value;
  const filter = devtoolsStore.state.filter.value;

  let filtered = transactions;

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

export const dependencyGraphData = devtoolsContext.computed(() => {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const selectedContext = devtoolsStore.state.selectedContext.value;
  
  if (!selectedContext) {
    return {
      nodes: Array.from(graph.nodes.values()),
      edges: Array.from(graph.edges.entries()).flatMap(([source, targets]) =>
        Array.from(targets).map(target => ({
          source,
          target,
          isActive: true,
        }))
      ),
    };
  }
  
  // Filter by context if needed
  const contextNodes = Array.from(graph.nodes.values()).filter(
    node => node.id.startsWith(selectedContext)
  );
  
  const nodeIds = new Set(contextNodes.map(n => n.id));
  
  const edges = Array.from(graph.edges.entries())
    .filter(([source]) => nodeIds.has(source))
    .flatMap(([source, targets]) =>
      Array.from(targets)
        .filter(target => nodeIds.has(target))
        .map(target => ({
          source,
          target,
          isActive: true,
        }))
    );
  
  return {
    nodes: contextNodes,
    edges,
  };
});

export const nodeDependencies = devtoolsContext.computed(() => {
  const graph = devtoolsStore.state.dependencyGraph.value;
  
  return (nodeId: string) => {
    const dependencies = graph.edges.get(nodeId) || new Set();
    const subscribers = graph.reverseEdges.get(nodeId) || new Set();
    
    return {
      dependencies: Array.from(dependencies).map(id => ({
        id,
        node: graph.nodes.get(id),
      })),
      subscribers: Array.from(subscribers).map(id => ({
        id,
        node: graph.nodes.get(id),
      })),
    };
  };
});

// Helper functions
export interface DevToolsMessage {
  type: string;
  data?: unknown;
}

interface ContextCreatedData {
  name?: string;
}

interface SignalCreatedEventData {
  id: string;
  name?: string;
  initialValue: unknown;
}

interface SignalWriteEventData {
  id: string;
  newValue: unknown;
}

interface ComputedCreatedEventData {
  id: string;
  name?: string;
}

interface EffectCreatedEventData {
  id: string;
  name?: string;
}

export function handleDevToolsMessage(message: DevToolsMessage) {
  console.log('[DevTools Store] Handling message:', message);

  switch (message.type) {
    case 'LATTICE_DETECTED':
      console.log('[DevTools Store] Setting connected to true');
      devtoolsStore.state.connected.value = true;
      break;

    case 'STATE_UPDATE':
      console.log('[DevTools Store] Updating state with:', message.data);
      if (message.data && typeof message.data === 'object') {
        const stateData = message.data as {
          connected?: boolean;
          contexts?: ContextInfo[];
          transactions?: Transaction[];
          selectedContext?: string | null;
        };
        if (stateData.connected !== undefined) {
          devtoolsStore.state.connected.value = stateData.connected;
        }
        if (stateData.contexts) {
          devtoolsStore.state.contexts.value = stateData.contexts;
        }
        if (stateData.transactions) {
          devtoolsStore.state.transactions.value = stateData.transactions;
        }
        if (stateData.selectedContext !== undefined) {
          devtoolsStore.state.selectedContext.value = stateData.selectedContext;
        }
      }
      break;

    case 'TRANSACTION':
      if (message.data && typeof message.data === 'object') {
        const event = message.data as LatticeEvent;
        const transaction: Transaction = {
          id: `tx_${Date.now()}_${Math.random()}`,
          timestamp: event.timestamp || Date.now(),
          contextId: event.contextId,
          type: getEventCategory(event.type),
          eventType: event.type,
          data: event.data as TransactionData,
        };

        // Add transaction (keep last 1000)
        devtoolsStore.state.transactions.value = [
          ...devtoolsStore.state.transactions.value.slice(-999),
          transaction,
        ];

        // Update context metadata
        updateContextFromEvent(event);
      }
      break;
  }
}

function getEventCategory(
  eventType: string
): 'signal' | 'computed' | 'effect' | 'batch' {
  if (eventType.startsWith('SIGNAL_')) return 'signal';
  if (eventType.startsWith('COMPUTED_')) return 'computed';
  if (eventType.startsWith('EFFECT_')) return 'effect';
  return 'batch';
}

interface LatticeEvent {
  type: string;
  contextId: string;
  timestamp?: number;
  data?: unknown;
}

function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsStore.state.contexts.value];
  const contextIndex = contexts.findIndex((c) => c.id === event.contextId);

  if (event.type === 'CONTEXT_CREATED' && contextIndex === -1) {
    const contextData = event.data as ContextCreatedData | undefined;
    contexts.push({
      id: event.contextId,
      name: contextData?.name || `Context ${event.contextId}`,
      signalCount: 0,
      computedCount: 0,
      effectCount: 0,
      signals: [],
      computeds: [],
      effects: [],
    });
  } else if (contextIndex !== -1) {
    const context = { ...contexts[contextIndex] };

    switch (event.type) {
      case 'SIGNAL_CREATED': {
        const signalData = event.data as SignalCreatedEventData;
        context.signalCount++;
        context.signals.push({
          id: signalData.id,
          name: signalData.name,
          value: signalData.initialValue,
          lastUpdated: event.timestamp || Date.now(),
        });
        break;
      }

      case 'SIGNAL_WRITE': {
        const writeData = event.data as SignalWriteEventData;
        const signalIndex = context.signals.findIndex(
          (s) => s.id === writeData.id
        );
        if (signalIndex !== -1) {
          context.signals[signalIndex] = {
            ...context.signals[signalIndex],
            value: writeData.newValue,
            lastUpdated: event.timestamp || Date.now(),
          };
        }
        break;
      }

      case 'COMPUTED_CREATED': {
        const computedData = event.data as ComputedCreatedEventData;
        context.computedCount++;
        context.computeds.push({
          id: computedData.id,
          name: computedData.name,
          value: undefined,
          dependencies: [],
          lastComputed: 0,
        });
        break;
      }

      case 'EFFECT_CREATED': {
        const effectData = event.data as EffectCreatedEventData;
        context.effectCount++;
        context.effects.push({
          id: effectData.id,
          name: effectData.name,
          isActive: true,
          lastRun: 0,
        });
        break;
      }

      case 'DEPENDENCY_UPDATE': {
        const depData = event.data as DependencyUpdateData;
        updateDependencyGraph(depData);
        break;
      }

      case 'GRAPH_SNAPSHOT': {
        const snapshotData = event.data as GraphSnapshotData;
        updateGraphSnapshot(snapshotData, event.timestamp || Date.now());
        break;
      }
    }

    contexts[contextIndex] = context;
  }

  devtoolsStore.state.contexts.value = contexts;
}

function updateDependencyGraph(data: DependencyUpdateData) {
  const graph = devtoolsStore.state.dependencyGraph.value;
  
  // Update node
  graph.nodes.set(data.id, {
    id: data.id,
    type: data.type,
    name: data.dependencies.find(d => d.id === data.id)?.name,
    value: data.value,
    isActive: true,
    isOutdated: false,
    hasSubscribers: data.subscribers.length > 0,
  });
  
  // Update edges (dependencies)
  const deps = new Set(data.dependencies.map(d => d.id));
  graph.edges.set(data.id, deps);
  
  // Update reverse edges (subscribers)
  data.dependencies.forEach(dep => {
    if (!graph.reverseEdges.has(dep.id)) {
      graph.reverseEdges.set(dep.id, new Set());
    }
    graph.reverseEdges.get(dep.id)!.add(data.id);
  });
  
  // Trigger update
  devtoolsStore.state.dependencyGraph.value = { ...graph };
}

function updateGraphSnapshot(data: GraphSnapshotData, timestamp: number) {
  const graph = devtoolsStore.state.dependencyGraph.value;
  
  // Clear and rebuild graph from snapshot
  graph.nodes.clear();
  graph.edges.clear();
  graph.reverseEdges.clear();
  
  // Add all nodes
  data.nodes.forEach(node => {
    graph.nodes.set(node.id, node);
  });
  
  // Add all edges
  data.edges.forEach(edge => {
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

// Removed time travel functionality

// Export context for disposal
export const devtoolsLatticeContext = devtoolsContext;
