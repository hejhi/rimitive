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
 * High-performance event emitter with batching
 */
export class EventEmitter {
  private events: DevToolsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isEnabled = true;
  
  private readonly config: Required<EventEmitterConfig>;

  constructor(config: EventEmitterConfig = {}) {
    this.config = {
      maxEvents: config.maxEvents ?? MAX_EVENTS,
      batchSize: config.batchSize ?? EVENT_BATCH_SIZE,
      flushInterval: config.flushInterval ?? FLUSH_INTERVAL,
      onFlush: config.onFlush ?? this.defaultFlush.bind(this),
    };
  }

  /**
   * Emit a DevTools event
   */
  emit(event: DevToolsEvent): void {
    if (!this.isEnabled) return;

    // Add event to buffer
    this.events.push(event);

    // Trim buffer if needed
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }

    // Schedule flush if not already scheduled
    if (!this.flushTimer && this.events.length > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * Get all buffered events
   */
  getEvents(): DevToolsEvent[] {
    return [...this.events];
  }

  /**
   * Clear all buffered events
   */
  clearEvents(): void {
    this.events = [];
    this.cancelFlush();
  }

  /**
   * Enable event emission
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable event emission
   */
  disable(): void {
    this.isEnabled = false;
    this.cancelFlush();
  }

  /**
   * Check if emission is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Force an immediate flush
   */
  flush(): void {
    this.cancelFlush();
    if (this.events.length > 0 && this.isEnabled) {
      this.performFlush();
    }
  }

  /**
   * Destroy the emitter
   */
  destroy(): void {
    this.disable();
    this.clearEvents();
  }

  /**
   * Schedule a flush operation
   */
  private scheduleFlush(): void {
    if (!this.isEnabled) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.performFlush();

      // Continue flushing if there are more events
      if (this.events.length > 0 && this.isEnabled) {
        this.scheduleFlush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Cancel any scheduled flush
   */
  private cancelFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Perform the flush operation
   */
  private performFlush(): void {
    if (!this.isEnabled || this.events.length === 0) return;

    // Get events to flush
    const eventsToFlush = this.events.slice(0, this.config.batchSize);
    this.events = this.events.slice(this.config.batchSize);

    // Call flush handler
    this.config.onFlush(eventsToFlush);
  }

  /**
   * Default flush implementation
   */
  private defaultFlush(events: DevToolsEvent[]): void {
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
}