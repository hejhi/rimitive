/**
 * @fileoverview Event system for Lattice DevTools
 * 
 * Manages event emission and communication with the browser extension.
 */

import type { DevToolsEvent, DevToolsOptions, DevToolsAPI } from './types';

let devToolsEnabled = false;
let eventBuffer: DevToolsEvent[] = [];
const contextMetadata = new Map<string, { id: string; name: string; created: number }>();

const MAX_EVENTS = 10000;
const EVENT_BATCH_SIZE = 100;
const FLUSH_INTERVAL = 16; // ~60fps

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the DevTools API
 */
export function initializeDevTools(_options: DevToolsOptions = {}): void {
  if (devToolsEnabled) return;
  
  devToolsEnabled = true;
  
  // Create the global DevTools API
  const api: DevToolsAPI = {
    enabled: true,
    version: '1.0.0',
    
    getEvents(): DevToolsEvent[] {
      return eventBuffer.slice();
    },
    
    clearEvents(): void {
      eventBuffer = [];
    },
    
    getContexts(): Array<{ id: string; name: string; created: number }> {
      return Array.from(contextMetadata.values());
    },
    
    isRecording(): boolean {
      return devToolsEnabled;
    },
    
    startRecording(): void {
      devToolsEnabled = true;
    },
    
    stopRecording(): void {
      devToolsEnabled = false;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    },
  };
  
  // Expose on window for extension access
  if (typeof window !== 'undefined') {
    (window as any).__LATTICE_DEVTOOLS__ = api;
    
    // Notify extension that DevTools are available
    window.postMessage({
      source: 'lattice-devtools',
      type: 'INIT',
      payload: {
        enabled: true,
        version: api.version,
      }
    }, '*');
  }
  
  // Start the flush timer
  scheduleFlush();
}

/**
 * Emit a DevTools event
 */
export function emitEvent(event: DevToolsEvent): void {
  if (!devToolsEnabled) return;
  
  // Add to buffer
  eventBuffer.push(event);
  
  // Track context metadata
  if (event.type === 'CONTEXT_CREATED' && event.data) {
    const data = event.data as { id: string; name: string };
    contextMetadata.set(event.contextId, {
      id: event.contextId,
      name: data.name,
      created: event.timestamp,
    });
  } else if (event.type === 'CONTEXT_DISPOSED' && event.data) {
    contextMetadata.delete(event.contextId);
  }
  
  // Trim buffer if needed
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer = eventBuffer.slice(-MAX_EVENTS);
  }
  
  // Schedule flush if not already scheduled
  if (!flushTimer) {
    scheduleFlush();
  }
}

/**
 * Schedule a flush of events to the extension
 */
function scheduleFlush(): void {
  if (!devToolsEnabled || typeof window === 'undefined') return;
  
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
    
    // Continue flushing if there are more events
    if (eventBuffer.length > 0 && devToolsEnabled) {
      scheduleFlush();
    }
  }, FLUSH_INTERVAL);
}

/**
 * Flush events to the extension
 */
function flushEvents(): void {
  if (!devToolsEnabled || typeof window === 'undefined' || eventBuffer.length === 0) {
    return;
  }
  
  // Get events to send (batch for performance)
  const eventsToSend = eventBuffer.slice(0, EVENT_BATCH_SIZE);
  eventBuffer = eventBuffer.slice(EVENT_BATCH_SIZE);
  
  // Send each event individually for now (can batch later if needed)
  for (const event of eventsToSend) {
    window.postMessage({
      source: 'lattice-devtools',
      type: 'EVENT',
      payload: event,
    }, '*');
  }
}

/**
 * Check if DevTools are enabled
 */
export function isDevToolsEnabled(): boolean {
  return devToolsEnabled;
}

/**
 * Get the DevTools API if available
 */
export function getDevToolsAPI(): DevToolsAPI | null {
  if (typeof window !== 'undefined' && (window as any).__LATTICE_DEVTOOLS__) {
    return (window as any).__LATTICE_DEVTOOLS__;
  }
  return null;
}