import { devtoolsState } from './devtoolsCtx';
import { LogEntry } from './types';
import { RimitiveEvent } from './messageHandler';
import { inferCategory } from './eventTypeManager';

// Track execution depth for indentation
let executionDepth = 0;
const depthTracker = new Map<string, number>();

// Track recent events for causality analysis
const recentEvents: { eventType: string; data: unknown; timestamp: number }[] =
  [];
const RECENT_EVENT_WINDOW = 100; // ms

/**
 * Process any instrumentation event
 */
export function processLogEntry(event: RimitiveEvent) {
  const timestamp = event.timestamp || Date.now();

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
}

/**
 * Create a log entry from an instrumentation event
 */
function createLogEntry(event: RimitiveEvent, timestamp: number): LogEntry {
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
function calculateExecutionLevel(event: RimitiveEvent): number {
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
    if (id) {
      const depth = depthTracker.get(id);
      if (depth !== undefined) {
        depthTracker.delete(id);
        return depth;
      }
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
 * Extract node ID from event data
 */
function extractNodeId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  // Specific ID fields for each primitive type
  if ('signalId' in obj && typeof obj.signalId === 'string') return obj.signalId;
  if ('computedId' in obj && typeof obj.computedId === 'string') return obj.computedId;
  if ('effectId' in obj && typeof obj.effectId === 'string') return obj.effectId;
  if ('batchId' in obj && typeof obj.batchId === 'string') return obj.batchId;

  // Generic ID fields
  if ('id' in obj && typeof obj.id === 'string') return obj.id;
  if ('nodeId' in obj && typeof obj.nodeId === 'string') return obj.nodeId;
  if ('resourceId' in obj && typeof obj.resourceId === 'string')
    return obj.resourceId;

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
  if ('displayName' in obj && typeof obj.displayName === 'string')
    return obj.displayName;
  if ('selector' in obj && typeof obj.selector === 'string')
    return obj.selector;

  return undefined;
}

/**
 * Generate a human-readable summary of the event
 */
function generateSummary(event: RimitiveEvent): string {
  const data = event.data as Record<string, unknown>;

  // Exclude ID fields (already shown as clickable name) and metadata
  const excludedFields = [
    'id',
    'nodeId',
    'resourceId',
    'contextId',
    'timestamp',
    'type',
    'signalId',
    'computedId',
    'effectId',
    'batchId',
  ];

  const fields = Object.entries(data)
    .filter(([key]) => !excludedFields.includes(key))
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');

  return fields;
}

/**
 * Add log entry to the store
 */
function addLogEntry(entry: LogEntry) {
  // Keep last 1000 log entries
  devtoolsState.logEntries([...devtoolsState.logEntries().slice(-999), entry]);
}

/**
 * Find related events for causality analysis
 */
export function findRelatedEvents(entry: LogEntry): LogEntry[] {
  const related: LogEntry[] = [];
  const logs = devtoolsState.logEntries();

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
