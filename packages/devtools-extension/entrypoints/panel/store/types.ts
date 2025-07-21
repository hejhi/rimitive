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
}

// Event data types used in various events
export interface SignalWriteData {
  id: string;
  name?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SignalReadData {
  id: string;
  name?: string;
  value: unknown;
  internal?: boolean;
  executionContext?: string;
  readContext?: { name?: string };
}

export interface NamedItemData {
  id: string;
  name?: string;
}

export interface ComputedEndEventData extends NamedItemData {
  value: unknown;
  duration?: number;
}

export interface EffectEndEventData extends NamedItemData {
  duration?: number;
  hasCleanup?: boolean;
}

export interface SelectorCreatedEventData {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType: string;
  selector: string;
}

export interface DependencyUpdateData {
  nodeId: string;
  nodeType: string;
  dependencies?: Array<{ id: string; name?: string }>;
  subscribers?: Array<{ id: string; name?: string }>;
}

export interface GraphSnapshotData {
  nodes: Array<{
    id: string;
    type: string;
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

// Context info with generic resource counts
export interface ContextInfo {
  id: string;
  name: string;
  created?: number;
  // Legacy specific counts
  signalCount?: number;
  computedCount?: number;
  effectCount?: number;
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
    type: 'all' | 'signal' | 'computed' | 'effect' | 'selector';
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

export interface ContextInfo {
  id: string;
  name: string;
  signalCount: number;
  computedCount: number;
  effectCount: number;
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

export interface ComputedEndEventData {
  id: string;
  name?: string;
  duration?: number;
  value?: unknown;
}

export interface EffectEndEventData {
  id: string;
  name?: string;
  duration?: number;
}

export interface SelectorCreatedEventData {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType: 'signal' | 'computed';
  selector: string;
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
    contextId?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    isActive: boolean;
  }>;
}

