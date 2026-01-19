import type { ConnectionStatus, ContextInfo, LogEntry, SnapshotData } from './types';
import type { GraphState } from './graphTypes';
import type { TimelineState } from './timelineTypes';
import type { SignalFunction, Readable } from '@rimitive/signals';
import { buildGraphStateFromLogEntries } from './snapshotGraphBuilder';

export type TabId = 'logs' | 'graph' | 'timeline';

export type FilterState = {
  type: string;
  search: string;
  hideInternal: boolean;
  nodeId: string | null;
};

type SignalsSvc = {
  signal: <T>(initial: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: (fn: () => void) => void;
};

// Common log filtering logic
function filterLogs(
  logs: LogEntry[],
  filter: FilterState,
  selectedContext: string | null,
  searchIn: string[]
) {
  return logs.filter((log) => {
    if (selectedContext && log.contextId !== selectedContext) return false;
    if (filter.nodeId && log.nodeId !== filter.nodeId) return false;
    if (filter.type !== 'all' && log.category !== filter.type) return false;

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

      if (!searchTargets.some((target) => target.toLowerCase().includes(search))) {
        return false;
      }
    }

    if (filter.hideInternal && log.isInternal) {
      return false;
    }

    return true;
  });
}

/**
 * DevTools behavior - encapsulates all devtools panel state
 */
export const devtoolsBehavior = (svc: SignalsSvc) => () => {
  // Connection state
  const connected = svc.signal(false);
  const connectionStatus = svc.signal<ConnectionStatus>('disconnected');

  // Context state
  const contexts = svc.signal<ContextInfo[]>([]);
  const selectedContext = svc.signal<string | null>(null);

  // Transaction state
  const selectedTransaction = svc.signal<string | null>(null);

  // UI state
  const activeTab = svc.signal<TabId>('logs');
  const filter = svc.signal<FilterState>({
    type: 'all',
    search: '',
    hideInternal: true,
    nodeId: null,
  });

  // Log entries
  const logEntries = svc.signal<LogEntry[]>([]);

  // Event types (for filtering)
  const availableEventTypes = svc.signal<Array<{ value: string; label: string }>>([
    { value: 'all', label: 'All Types' },
  ]);

  // Snapshot state
  const snapshot = svc.signal<SnapshotData>(null);
  const snapshotSelectedContext = svc.signal<string | null>(null);
  const snapshotSelectedTransaction = svc.signal<string | null>(null);
  const snapshotFilter = svc.signal<FilterState>({
    type: 'all',
    search: '',
    hideInternal: true,
    nodeId: null,
  });
  const snapshotActiveTab = svc.signal<TabId>('logs');

  // Graph state
  const graphNodes = svc.signal<GraphState['nodes']>(new Map());
  const graphEdges = svc.signal<GraphState['edges']>(new Map());
  const graphDependencies = svc.signal<GraphState['dependencies']>(new Map());
  const graphDependents = svc.signal<GraphState['dependents']>(new Map());
  const selectedNodeId = svc.signal<string | null>(null);
  const hoveredNodeId = svc.signal<string | null>(null);
  const viewMode = svc.signal<'full' | 'focused'>('full');

  // Timeline state
  const timelineState = svc.signal<TimelineState>({
    cascades: [],
    currentCascadeIndex: null,
    timeRange: null,
  });
  const snapshotTimelineState = svc.signal<TimelineState>({
    cascades: [],
    currentCascadeIndex: null,
    timeRange: null,
  });

  // Computed: graph state object
  const graphState = svc.computed((): GraphState => ({
    nodes: graphNodes(),
    edges: graphEdges(),
    dependencies: graphDependencies(),
    dependents: graphDependents(),
  }));

  // Computed: filtered transactions
  const filteredTransactions = svc.computed(() => {
    return filterLogs(logEntries(), filter(), selectedContext(), [
      'eventType',
      'nodeName',
      'summary',
    ]);
  });

  // Computed: selected context data
  const selectedContextData = svc.computed(() => {
    const id = selectedContext();
    if (!id) return null;
    return contexts().find((c) => c.id === id);
  });

  // Computed: selected transaction data
  const selectedTransactionData = svc.computed(() => {
    const id = selectedTransaction();
    if (!id) return null;
    return filteredTransactions().find((log) => log.id === id) ?? null;
  });

  // Computed: filtered log entries (last 500)
  const filteredLogEntries = svc.computed(() => {
    const filtered = filterLogs(logEntries(), filter(), selectedContext(), [
      'nodeName',
      'summary',
    ]);
    return filtered.slice(-500);
  });

  // Computed: snapshot context filtered entries
  const snapshotContextFilteredEntries = svc.computed(() => {
    const snap = snapshot();
    const ctx = snapshotSelectedContext();
    if (!snap) return [];
    let entries = snap.logEntries;
    if (ctx) {
      entries = entries.filter((e) => e.contextId === ctx);
    }
    return entries;
  });

  // Computed: snapshot filtered log entries
  const snapshotFilteredLogEntries = svc.computed(() => {
    const entries = snapshotContextFilteredEntries();
    const f = snapshotFilter();
    let filtered = entries;

    if (f.hideInternal) {
      filtered = filtered.filter((e) => !e.isInternal);
    }
    if (f.type !== 'all') {
      filtered = filtered.filter((e) => e.eventType === f.type);
    }
    if (f.search) {
      const search = f.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.nodeName?.toLowerCase().includes(search) ||
          e.summary?.toLowerCase().includes(search) ||
          e.nodeId?.toLowerCase().includes(search)
      );
    }
    if (f.nodeId) {
      filtered = filtered.filter((e) => e.nodeId === f.nodeId);
    }
    return filtered;
  });

  // Computed: snapshot graph state
  const snapshotGraphState = svc.computed(() => {
    return buildGraphStateFromLogEntries(snapshotContextFilteredEntries());
  });

  // Computed: focused graph view
  const focusedView = svc.computed(() => {
    const nodeId = selectedNodeId();
    if (!nodeId) return null;

    const state = graphState();
    const center = state.nodes.get(nodeId);
    if (!center) return null;

    const depIds = state.dependencies.get(nodeId) ?? new Set();
    const dependencies = Array.from(depIds)
      .map((id) => state.nodes.get(id))
      .filter((node): node is NonNullable<typeof node> => node !== undefined);

    const dependentIds = state.dependents.get(nodeId) ?? new Set();
    const dependents = Array.from(dependentIds)
      .map((id) => state.nodes.get(id))
      .filter((node): node is NonNullable<typeof node> => node !== undefined);

    const dependencyEdges = Array.from(depIds)
      .map((producerId) => state.edges.get(`${nodeId}->${producerId}`))
      .filter((edge): edge is NonNullable<typeof edge> => edge !== undefined);

    const dependentEdges = Array.from(dependentIds)
      .map((consumerId) => state.edges.get(`${consumerId}->${nodeId}`))
      .filter((edge): edge is NonNullable<typeof edge> => edge !== undefined);

    return { center, dependencies, dependents, dependencyEdges, dependentEdges };
  });

  // Computed: node metrics
  const nodeMetrics = svc.computed(() => {
    const state = graphState();
    const metrics = new Map<string, { connectionCount: number; isOrphaned: boolean }>();
    for (const [id, node] of state.nodes) {
      const dependencyCount = state.dependencies.get(id)?.size ?? 0;
      const dependentCount = state.dependents.get(id)?.size ?? 0;
      const connectionCount = dependencyCount + dependentCount;
      // A node is orphaned if it has no dependents and is not an effect/subscribe
      const isTerminal = node.type === 'effect' || node.type === 'subscribe';
      const isOrphaned = !isTerminal && dependentCount === 0;

      metrics.set(id, { connectionCount, isOrphaned });
    }
    return metrics;
  });

  // Computed: current cascade
  const currentCascade = svc.computed(() => {
    const state = timelineState();
    if (state.currentCascadeIndex === null) return null;
    return state.cascades[state.currentCascadeIndex] ?? null;
  });

  // Computed: current snapshot cascade
  const currentSnapshotCascade = svc.computed(() => {
    const state = snapshotTimelineState();
    if (state.currentCascadeIndex === null) return null;
    return state.cascades[state.currentCascadeIndex] ?? null;
  });

  return {
    // Connection
    connected,
    connectionStatus,

    // Contexts
    contexts,
    selectedContext,

    // Transactions
    selectedTransaction,

    // UI
    activeTab,
    filter,

    // Logs
    logEntries,
    availableEventTypes,

    // Snapshot
    snapshot,
    snapshotSelectedContext,
    snapshotSelectedTransaction,
    snapshotFilter,
    snapshotActiveTab,

    // Graph
    graphNodes,
    graphEdges,
    graphDependencies,
    graphDependents,
    graphState,
    selectedNodeId,
    hoveredNodeId,
    viewMode,
    focusedView,
    nodeMetrics,

    // Timeline
    timelineState,
    snapshotTimelineState,
    currentCascade,
    currentSnapshotCascade,

    // Computed
    filteredTransactions,
    selectedContextData,
    selectedTransactionData,
    filteredLogEntries,
    snapshotContextFilteredEntries,
    snapshotFilteredLogEntries,
    snapshotGraphState,

    // Service (for creating additional computeds/effects)
    svc,
  };
};

export type DevtoolsState = ReturnType<ReturnType<typeof devtoolsBehavior>>;
