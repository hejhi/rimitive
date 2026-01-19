import { devtoolsContext } from './devtoolsCtx';
import { devtoolsState } from './devtoolsCtx';
import { graphState } from './graphState';
import type { LogEntry } from './types';
import type { GraphState } from './graphTypes';
import type { Cascade, CascadeEffect, TimelineState } from './timelineTypes';

/**
 * Filter entries based on context and hideInternal settings
 */
function filterEntries(
  entries: LogEntry[],
  selectedContext: string | null,
  hideInternal: boolean
): LogEntry[] {
  return entries.filter((entry) => {
    // Context filter
    if (selectedContext && entry.contextId !== selectedContext) return false;
    // Hide internal filter
    if (hideInternal && entry.isInternal) return false;
    return true;
  });
}

/**
 * Timeline state signal
 */
export const timelineState = devtoolsContext.signal<TimelineState>({
  cascades: [],
  currentCascadeIndex: null,
  timeRange: null,
});

/**
 * Time window for grouping related events into a cascade (ms)
 */
const CASCADE_WINDOW_MS = 50;

/**
 * Event types that start a new cascade (root causes)
 */
const CASCADE_ROOT_EVENTS = ['signal:write'];

/**
 * Event types that are effects of a cascade
 */
const CASCADE_EFFECT_EVENTS = [
  'computed:value',
  'computed:read',
  'effect:run',
  'effect:created',
  'subscribe:notify',
];

/**
 * Check if an event type starts a cascade
 */
function isCascadeRoot(eventType: string): boolean {
  return CASCADE_ROOT_EVENTS.some((root) => eventType.includes(root));
}

/**
 * Check if an event type is a cascade effect
 */
function isCascadeEffect(eventType: string): boolean {
  return CASCADE_EFFECT_EVENTS.some((effect) => eventType.includes(effect));
}

/**
 * Build cascades from log entries
 * Groups related events into propagation chains
 */
export function buildCascades(entries: LogEntry[]): Cascade[] {
  if (entries.length === 0) return [];

  const state = graphState();
  const cascades: Cascade[] = [];
  let currentCascade: Cascade | null = null;

  // Sort entries by timestamp
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);

  for (const entry of sorted) {
    // Start new cascade on root event
    if (isCascadeRoot(entry.eventType)) {
      // Close previous cascade if exists
      if (currentCascade) {
        currentCascade.endTime = currentCascade.effects.length > 0
          ? currentCascade.effects[currentCascade.effects.length - 1].event.timestamp
          : currentCascade.startTime;
        cascades.push(currentCascade);
      }

      const rootNode = entry.nodeId ? state.nodes.get(entry.nodeId) ?? null : null;

      currentCascade = {
        id: `cascade_${entry.timestamp}_${entry.id}`,
        rootEvent: entry,
        rootNode,
        effects: [],
        startTime: entry.timestamp,
        endTime: entry.timestamp,
        affectedNodeIds: new Set(entry.nodeId ? [entry.nodeId] : []),
      };
      continue;
    }

    // Add effect to current cascade if within time window
    if (currentCascade && isCascadeEffect(entry.eventType)) {
      const timeDelta = entry.timestamp - currentCascade.startTime;

      // Check if within time window
      if (timeDelta <= CASCADE_WINDOW_MS) {
        // Check if this node is connected to the cascade
        const nodeId = entry.nodeId;
        const isConnected = nodeId && isNodeConnectedToCascade(nodeId, currentCascade, state);

        if (isConnected || !nodeId) {
          const node = nodeId ? state.nodes.get(nodeId) ?? null : null;
          const depth = nodeId ? getDepthFromRoot(nodeId, currentCascade.rootEvent.nodeId, state) : 0;

          const effect: CascadeEffect = {
            event: entry,
            node,
            deltaMs: timeDelta,
            depth,
          };

          currentCascade.effects.push(effect);
          if (nodeId) {
            currentCascade.affectedNodeIds.add(nodeId);
          }
        }
      }
    }
  }

  // Close final cascade
  if (currentCascade) {
    currentCascade.endTime = currentCascade.effects.length > 0
      ? currentCascade.effects[currentCascade.effects.length - 1].event.timestamp
      : currentCascade.startTime;
    cascades.push(currentCascade);
  }

  return cascades;
}

/**
 * Check if a node is connected to any node in the cascade
 */
function isNodeConnectedToCascade(
  nodeId: string,
  cascade: Cascade,
  state: GraphState
): boolean {
  // Check if this node depends on any affected node
  const dependencies = state.dependencies.get(nodeId);
  if (dependencies) {
    for (const depId of dependencies) {
      if (cascade.affectedNodeIds.has(depId)) {
        return true;
      }
    }
  }

  // Also check if any affected node depends on this node (reverse direction)
  for (const affectedId of cascade.affectedNodeIds) {
    const affectedDeps = state.dependencies.get(affectedId);
    if (affectedDeps?.has(nodeId)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the graph depth from root to target
 */
function getDepthFromRoot(
  targetId: string,
  rootId: string | undefined,
  state: GraphState
): number {
  if (!rootId || targetId === rootId) return 0;

  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === targetId) return current.depth;

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    // Get dependents of current node
    const dependents = state.dependents.get(current.id);
    if (dependents) {
      for (const depId of dependents) {
        if (!visited.has(depId)) {
          queue.push({ id: depId, depth: current.depth + 1 });
        }
      }
    }
  }

  return 1; // Default depth if not found
}

/**
 * Rebuild cascades from current log entries
 */
export function rebuildCascades(): void {
  const allEntries = devtoolsState.logEntries();
  const selectedContext = devtoolsState.selectedContext();
  const hideInternal = devtoolsState.filter().hideInternal;
  const entries = filterEntries(allEntries, selectedContext, hideInternal);
  const cascades = buildCascades(entries);

  // Compute time range from actual min/max timestamps (not array order)
  let timeRange: { start: number; end: number } | null = null;
  if (entries.length > 0) {
    let minTime = entries[0].timestamp;
    let maxTime = entries[0].timestamp;
    for (const entry of entries) {
      if (entry.timestamp < minTime) minTime = entry.timestamp;
      if (entry.timestamp > maxTime) maxTime = entry.timestamp;
    }
    timeRange = { start: minTime, end: maxTime };
  }

  timelineState({
    ...timelineState(),
    cascades,
    timeRange,
  });
}

/**
 * Select a cascade by index
 */
export function selectCascade(index: number | null): void {
  timelineState({
    ...timelineState(),
    currentCascadeIndex: index,
  });
}

/**
 * Step to next cascade
 */
export function nextCascade(): void {
  const state = timelineState();
  if (state.cascades.length === 0) return;

  const nextIndex = state.currentCascadeIndex === null
    ? 0
    : Math.min(state.currentCascadeIndex + 1, state.cascades.length - 1);

  selectCascade(nextIndex);
}

/**
 * Step to previous cascade
 */
export function prevCascade(): void {
  const state = timelineState();
  if (state.cascades.length === 0) return;

  const prevIndex = state.currentCascadeIndex === null
    ? state.cascades.length - 1
    : Math.max(state.currentCascadeIndex - 1, 0);

  selectCascade(prevIndex);
}

/**
 * Get current cascade
 */
export const currentCascade = devtoolsContext.computed(() => {
  const state = timelineState();
  if (state.currentCascadeIndex === null) return null;
  return state.cascades[state.currentCascadeIndex] ?? null;
});

/**
 * Clear timeline state
 */
export function clearTimeline(): void {
  timelineState({
    cascades: [],
    currentCascadeIndex: null,
    timeRange: null,
  });
}
