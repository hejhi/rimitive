import type { LogEntry } from './types';
import type { GraphNode } from './graphTypes';

/**
 * A single effect within a cascade
 */
export type CascadeEffect = {
  event: LogEntry;
  node: GraphNode | null;
  deltaMs: number; // Time since cascade root
  depth: number; // Graph distance from root
};

/**
 * A cascade is a signal write + all its downstream effects
 * Represents a single "wave" of reactivity propagating through the graph
 */
export type Cascade = {
  id: string;
  rootEvent: LogEntry;
  rootNode: GraphNode | null;
  effects: CascadeEffect[];
  startTime: number;
  endTime: number;
  affectedNodeIds: Set<string>;
};

/**
 * Timeline visualization state
 */
export type TimelineState = {
  // All detected cascades from log entries
  cascades: Cascade[];

  // Currently selected cascade index
  currentCascadeIndex: number | null;

  // Time range for the histogram
  timeRange: {
    start: number;
    end: number;
  } | null;
};

