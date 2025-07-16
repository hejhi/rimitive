/**
 * Event emitter for DevTools
 * 
 * This module provides a high-performance event emission system
 * with batching and throttling capabilities.
 */

import type { DevToolsEvent } from '../types';
import { MAX_EVENTS, EVENT_BATCH_SIZE, FLUSH_INTERVAL } from '../constants';

/**
 * Event emitter configuration
 */
export interface EventEmitterConfig {
  maxEvents?: number;
  batchSize?: number;
  flushInterval?: number;
  onFlush?: (events: DevToolsEvent[]) => void;
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  emit(event: DevToolsEvent): void;
  getEvents(): DevToolsEvent[];
  clearEvents(): void;
  enable(): void;
  disable(): void;
  readonly enabled: boolean;
  flush(): void;
  destroy(): void;
}

/**
 * Default flush implementation
 */
function defaultFlush(events: DevToolsEvent[]): void {
  if (typeof window === 'undefined') return;

  // Send events to the extension
  for (const event of events) {
    window.postMessage({
      source: 'lattice-devtools',
      type: 'EVENT',
      payload: event,
    }, '*');
  }
}

/**
 * Creates a high-performance event emitter with batching
 */
export function createEventEmitter(config: EventEmitterConfig = {}): EventEmitter {
  // Private state
  let events: DevToolsEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let isEnabled = true;
  
  // Resolved configuration
  const resolvedConfig = {
    maxEvents: config.maxEvents ?? MAX_EVENTS,
    batchSize: config.batchSize ?? EVENT_BATCH_SIZE,
    flushInterval: config.flushInterval ?? FLUSH_INTERVAL,
    onFlush: config.onFlush ?? defaultFlush,
  };

  /**
   * Schedule a flush operation
   */
  function scheduleFlush(): void {
    if (!isEnabled) return;

    flushTimer = setTimeout(() => {
      flushTimer = null;
      performFlush();

      // Continue flushing if there are more events
      if (events.length > 0 && isEnabled) {
        scheduleFlush();
      }
    }, resolvedConfig.flushInterval);
  }

  /**
   * Cancel any scheduled flush
   */
  function cancelFlush(): void {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  /**
   * Perform the flush operation
   */
  function performFlush(): void {
    if (!isEnabled || events.length === 0) return;

    // Get events to flush
    const eventsToFlush = events.slice(0, resolvedConfig.batchSize);
    events = events.slice(resolvedConfig.batchSize);

    // Call flush handler
    resolvedConfig.onFlush(eventsToFlush);
  }

  // Return the public interface
  return {
    emit(event: DevToolsEvent): void {
      if (!isEnabled) return;

      // Add event to buffer
      events.push(event);

      // Trim buffer if needed
      if (events.length > resolvedConfig.maxEvents) {
        events = events.slice(-resolvedConfig.maxEvents);
      }

      // Schedule flush if not already scheduled
      if (!flushTimer && events.length > 0) {
        scheduleFlush();
      }
    },

    getEvents(): DevToolsEvent[] {
      return [...events];
    },

    clearEvents(): void {
      events = [];
      cancelFlush();
    },

    enable(): void {
      isEnabled = true;
    },

    disable(): void {
      isEnabled = false;
      cancelFlush();
    },

    get enabled(): boolean {
      return isEnabled;
    },

    flush(): void {
      cancelFlush();
      if (events.length > 0 && isEnabled) {
        performFlush();
      }
    },

    destroy(): void {
      isEnabled = false;
      cancelFlush();
      events = [];
    },
  };
}