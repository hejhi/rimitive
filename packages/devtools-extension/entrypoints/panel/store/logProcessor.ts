import { devtoolsStore } from './devtoolsCtx';
import {
  LogEntry,
  DependencyUpdateData,
  GraphSnapshotData,
} from './types';
import { LatticeEvent } from './messageHandler';
import { updateDependencyGraph, updateGraphSnapshot } from './dependencyGraph';

// Track execution depth for indentation
let executionDepth = 0;
const depthTracker = new Map<string, number>();

// Track recent events for causality analysis
const recentEvents: { eventType: string; data: unknown; timestamp: number }[] = [];
const RECENT_EVENT_WINDOW = 100; // ms

/**
 * Process any instrumentation event
 */
export function processLogEntry(event: LatticeEvent) {
  const timestamp = event.timestamp || Date.now();
  
  // Special handling for graph-related events
  if (event.type === 'DEPENDENCY_UPDATE') {
    updateDependencyGraph(event.data as DependencyUpdateData, event.contextId);
    return;
  }
  
  if (event.type === 'GRAPH_SNAPSHOT') {
    updateGraphSnapshot(event.data as GraphSnapshotData, timestamp, event.contextId);
    return;
  }
  
  // Clean up old recent events
  const cutoff = timestamp - RECENT_EVENT_WINDOW;
  while (recentEvents.length > 0 && recentEvents[0].timestamp < cutoff) {
    recentEvents.shift();
  }
  
  // Track this event
  recentEvents.push({ eventType: event.type, data: event.data, timestamp });
  
  // Create log entry
  const entry = createLogEntry(event, timestamp);
  
  // Add to log entries
  addLogEntry(entry);
  
  // Update context counts for resource creation/disposal
  updateContextCounts(event);
}

/**
 * Create a log entry from an instrumentation event
 */
function createLogEntry(event: LatticeEvent, timestamp: number): LogEntry {
  const level = calculateExecutionLevel(event);
  
  return {
    id: `log_${timestamp}_${Math.random()}`,
    timestamp,
    eventType: event.type,
    contextId: event.contextId,
    data: event.data as Record<string, unknown>,
    level,
    category: inferCategory(event.type),
    nodeId: extractNodeId(event.data),
    nodeName: extractNodeName(event.data),
    summary: generateSummary(event),
  };
}

/**
 * Calculate execution level for proper indentation
 */
function calculateExecutionLevel(event: LatticeEvent): number {
  // Handle start/end event pairs
  if (event.type.includes('_START') || event.type.includes('_BEGIN')) {
    const depth = executionDepth++;
    const id = extractNodeId(event.data);
    if (id) {
      depthTracker.set(id, depth);
    }
    return depth;
  }
  
  if (event.type.includes('_END') || event.type.includes('_COMPLETE')) {
    executionDepth = Math.max(0, executionDepth - 1);
    const id = extractNodeId(event.data);
    if (id && depthTracker.has(id)) {
      const depth = depthTracker.get(id)!;
      depthTracker.delete(id);
      return depth;
    }
    return executionDepth;
  }
  
  // For other events, check if they're within an execution context
  if (event.type.includes('_READ') || event.type.includes('_ACCESS')) {
    return executionDepth + 1;
  }
  
  return executionDepth;
}

/**
 * Infer category from event type
 */
function inferCategory(eventType: string): string {
  const type = eventType.toLowerCase();
  
  if (type.includes('signal')) return 'signal';
  if (type.includes('computed')) return 'computed';
  if (type.includes('effect')) return 'effect';
  if (type.includes('batch')) return 'batch';
  if (type.includes('store')) return 'store';
  if (type.includes('selector')) return 'selector';
  
  // For custom extensions, use the first part of the event type
  const parts = eventType.split('_');
  return parts[0].toLowerCase();
}

/**
 * Extract node ID from event data
 */
function extractNodeId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  
  const obj = data as Record<string, unknown>;
  
  // Common ID fields
  if ('id' in obj && typeof obj.id === 'string') return obj.id;
  if ('nodeId' in obj && typeof obj.nodeId === 'string') return obj.nodeId;
  if ('resourceId' in obj && typeof obj.resourceId === 'string') return obj.resourceId;
  if ('batchId' in obj && typeof obj.batchId === 'string') return obj.batchId;
  
  return undefined;
}

/**
 * Extract node name from event data
 */
function extractNodeName(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  
  const obj = data as Record<string, unknown>;
  
  // Common name fields
  if ('name' in obj && typeof obj.name === 'string') return obj.name;
  if ('label' in obj && typeof obj.label === 'string') return obj.label;
  if ('displayName' in obj && typeof obj.displayName === 'string') return obj.displayName;
  if ('selector' in obj && typeof obj.selector === 'string') return obj.selector;
  
  return undefined;
}

/**
 * Generate a human-readable summary of the event
 */
function generateSummary(event: LatticeEvent): string {
  const data = event.data as Record<string, unknown>;
  
  // Handle common event patterns
  switch (event.type) {
    case 'SIGNAL_WRITE':
      return `${JSON.stringify(data.oldValue)} → ${JSON.stringify(data.newValue)}`;
    
    case 'SIGNAL_READ':
      return `Read: ${JSON.stringify(data.value)}`;
    
    case 'COMPUTED_START':
      return 'Computing...';
    
    case 'COMPUTED_END':
      return `Result: ${JSON.stringify(data.value)}${data.duration ? ` (${Number(data.duration).toFixed(2)}ms)` : ''}`;
    
    case 'EFFECT_START':
      return 'Running effect...';
    
    case 'EFFECT_END':
      return `Completed${data.duration ? ` (${Number(data.duration).toFixed(2)}ms)` : ''}`;
    
    case 'BATCH_START':
      return 'Starting batch...';
      
    case 'BATCH_END':
      return 'Batch completed';
    
    default: {
      // For custom events, try to create a meaningful summary
      if ('value' in data) {
        return `Value: ${JSON.stringify(data.value)}`;
      }
      if ('duration' in data && typeof data.duration === 'number') {
        return `Duration: ${data.duration.toFixed(2)}ms`;
      }
      if ('count' in data) {
        return `Count: ${JSON.stringify(data.count)}`;
      }
      
      // Show first few data fields
      const fields = Object.entries(data)
        .filter(([key]) => !['id', 'nodeId', 'contextId', 'timestamp'].includes(key))
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      
      return fields || event.type;
    }
  }
}

/**
 * Update context resource counts
 */
function updateContextCounts(event: LatticeEvent) {
  // Update context counts for creation events
  if (event.type.includes('_CREATED')) {
    const category = inferCategory(event.type);
    updateContextCount(event.contextId, category, 1);
  }
  
  if (event.type.includes('_DISPOSED') || event.type.includes('_DESTROYED')) {
    const category = inferCategory(event.type);
    updateContextCount(event.contextId, category, -1);
  }
}

/**
 * Update context resource count
 */
function updateContextCount(contextId: string, category: string, delta: number) {
  const contexts = devtoolsStore.state.contexts.value;
  const context = contexts.find(c => c.id === contextId);
  
  if (!context) return;
  
  // Initialize resource counts if needed
  if (!context.resourceCounts) {
    context.resourceCounts = {};
  }
  
  // Update the count
  context.resourceCounts[category] = (context.resourceCounts[category] || 0) + delta;
  
  // Trigger reactive update
  devtoolsStore.state.contexts.value = [...contexts];
}

/**
 * Add log entry to the store
 */
function addLogEntry(entry: LogEntry) {
  // Keep last 1000 log entries
  devtoolsStore.state.logEntries.value = [
    ...devtoolsStore.state.logEntries.value.slice(-999),
    entry,
  ];
}

/**
 * Find what triggered a computed/effect based on recent writes
 */
export function findTriggeredBy(nodeId: string): string[] {
  const graph = devtoolsStore.state.dependencyGraph.value;
  const dependencies = graph.reverseEdges.get(nodeId) || new Set();

  for (const event of recentEvents) {
    if (event.eventType.includes('WRITE') || event.eventType.includes('UPDATE')) {
      const data = event.data as Record<string, unknown>;
      const id = extractNodeId(data);
      if (id && dependencies.has(id)) {
        return [id];
      }
    }
  }
  return [];
}

/**
 * Find related events for causality analysis
 */
export function findRelatedEvents(entry: LogEntry): LogEntry[] {
  const related: LogEntry[] = [];
  const logs = devtoolsStore.state.logEntries.value;
  
  // Find events that might have triggered this one
  if (entry.nodeId) {
    // Look for recent writes or updates that might have triggered this
    for (const log of logs) {
      if (log.timestamp < entry.timestamp - RECENT_EVENT_WINDOW) continue;
      if (log.timestamp >= entry.timestamp) break;
      
      // Check if this could be a trigger
      if (log.eventType.includes('WRITE') || log.eventType.includes('UPDATE')) {
        related.push(log);
      }
    }
  }
  
  return related;
}