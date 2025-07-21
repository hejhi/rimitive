// Log entry for any instrumentation event
export interface LogEntry {
  id: string;
  timestamp: number;
  eventType: string; // The event type from instrumentation (e.g., 'SIGNAL_WRITE', 'MY_CUSTOM_EVENT')
  level: number; // indentation level for display
  nodeId?: string; // Resource ID if available
  nodeName?: string; // Resource name if available
  contextId: string;
  data: Record<string, unknown>; // The raw event data
  // Derived fields for display
  category: string; // Inferred from event type
  summary?: string; // Human-readable summary
  rawData?: unknown; // For TransactionDetail component
}

// Generic event data shape - instrumentation emits these
export interface ResourceEventData {
  id: string;
  name?: string;
  type?: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  duration?: number;
  dependencies?: Array<{ id: string; name?: string }>;
  subscribers?: Array<{ id: string; name?: string }>;
  [key: string]: unknown; // Allow any other fields from instrumentation
}

// Context info with generic resource counts
export interface ContextInfo {
  id: string;
  name: string;
  created?: number;
  // Generic resource counts for any extension type
  resourceCounts?: Record<string, number>;
}

export interface DevToolsState {
  connected: boolean;
  contexts: ContextInfo[];
  selectedContext: string | null;
  selectedTransaction: string | null;
  selectedTab: 'logs' | 'timeline' | 'graph';
  filter: {
    type: string; // Generic type filter
    search: string;
    hideInternal: boolean;
  };
  dependencyGraph: DependencyGraph;
  lastSnapshot: GraphSnapshot | null;
  logEntries: LogEntry[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>; // source -> targets
  reverseEdges: Map<string, Set<string>>; // target -> sources
}

export interface DependencyNode {
  id: string;
  type: string; // Any resource type from instrumentation
  name?: string;
  value?: unknown;
  isActive: boolean;
  isOutdated?: boolean;
  hasSubscribers?: boolean;
  contextId?: string;
}

export interface GraphSnapshot {
  timestamp: number;
  nodes: DependencyNode[];
  edges: Array<{ source: string; target: string; isActive: boolean }>;
}

// Aliases for event data types that components expect
export type DependencyUpdateData = ResourceEventData;
export type GraphSnapshotData = {
  nodes: DependencyNode[];
  edges: Array<{ source: string; target: string; isActive: boolean }>;
};

