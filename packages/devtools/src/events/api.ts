/**
 * DevTools API management
 * 
 * This module manages the DevTools API for accessing debugging information
 * from instrumented Lattice contexts.
 */

import type { DevToolsAPI, DevToolsEvent } from '../types';
import { DEVTOOLS_VERSION, DEVTOOLS_WINDOW_KEY, MESSAGE_SOURCE } from '../constants';
import type { EventEmitter } from './emitter';

// Extend Window interface for DevTools
declare global {
  interface Window {
    [DEVTOOLS_WINDOW_KEY]?: DevToolsAPI;
  }
}

/**
 * Context metadata for tracking
 */
export interface ContextMetadata {
  id: string;
  name: string;
  created: number;
  signalCount: number;
  computedCount: number;
  effectCount: number;
}

/**
 * DevTools API Manager interface
 */
export interface DevToolsAPIManager {
  initialize(): void;
  registerContext(id: string, name: string): void;
  unregisterContext(id: string): void;
  updateContextCount(
    contextId: string,
    type: 'signal' | 'computed' | 'effect',
    delta?: number
  ): void;
}

// Track all API manager instances for aggregation
const allManagers: Array<{
  contexts: Map<string, ContextMetadata>;
  eventEmitter: EventEmitter;
}> = [];
let globalAPIInitialized = false;

/**
 * Creates a DevTools API manager
 */
export function createDevToolsAPIManager(eventEmitter: EventEmitter): DevToolsAPIManager {
  // Private state
  const contexts = new Map<string, ContextMetadata>();
  
  // Register this instance for global aggregation
  const managerInstance = { contexts, eventEmitter };
  allManagers.push(managerInstance);

  return {
    initialize(): void {
      // Only initialize the global API once
      if (globalAPIInitialized) return;
      globalAPIInitialized = true;

      // Create the API object that aggregates from all managers
      const api: DevToolsAPI = {
        enabled: true,
        version: DEVTOOLS_VERSION,
        
        getEvents: () => {
          // Aggregate events from all managers
          const allEvents: DevToolsEvent[] = [];
          for (const manager of allManagers) {
            allEvents.push(...manager.eventEmitter.getEvents());
          }
          // Sort by timestamp
          return allEvents.sort((a, b) => a.timestamp - b.timestamp);
        },
        
        clearEvents: () => {
          // Clear events from all managers
          for (const manager of allManagers) {
            manager.eventEmitter.clearEvents();
          }
        },
        
        getContexts: () => {
          // Aggregate contexts from all managers
          const allContexts: ContextMetadata[] = [];
          for (const manager of allManagers) {
            allContexts.push(...Array.from(manager.contexts.values()));
          }
          return allContexts;
        },
        
        isRecording: () => {
          // Recording if any manager is recording
          return allManagers.some(m => m.eventEmitter.enabled);
        },
        
        startRecording: () => {
          // Start recording on all managers
          for (const manager of allManagers) {
            manager.eventEmitter.enable();
          }
        },
        
        stopRecording: () => {
          // Stop recording on all managers
          for (const manager of allManagers) {
            manager.eventEmitter.disable();
          }
        },
      };
      
      // Expose on window for extension access
      if (typeof window !== 'undefined') {
        window[DEVTOOLS_WINDOW_KEY] = api;
        
        // Notify extension that DevTools are available
        window.postMessage({
          source: MESSAGE_SOURCE,
          type: 'LATTICE_DETECTED',
          payload: {
            enabled: true,
            version: api.version,
          }
        }, '*');
        
        // Listen for state requests from extension
        window.addEventListener('message', (event) => {
          if (event.source !== window || !event.data) return;
          
          const data = event.data as Record<string, unknown>;
          if (data.source === 'lattice-devtools-request' && data.type === 'REQUEST_STATE') {
            // Send current state
            const contexts = api.getContexts();
            window.postMessage({
              source: MESSAGE_SOURCE,
              type: 'STATE_RESPONSE',
              payload: {
                connected: true,
                contexts,
                transactions: [], // Events will be sent separately
                selectedContext: contexts.length > 0 ? contexts[0]?.id || null : null
              }
            }, '*');
          }
        });
      }
    },

    registerContext(id: string, name: string): void {
      contexts.set(id, {
        id,
        name,
        created: Date.now(),
        signalCount: 0,
        computedCount: 0,
        effectCount: 0,
      });
    },

    unregisterContext(id: string): void {
      contexts.delete(id);
    },

    updateContextCount(
      contextId: string,
      type: 'signal' | 'computed' | 'effect',
      delta: number = 1
    ): void {
      const context = contexts.get(contextId);
      if (!context) return;

      switch (type) {
        case 'signal':
          context.signalCount += delta;
          break;
        case 'computed':
          context.computedCount += delta;
          break;
        case 'effect':
          context.effectCount += delta;
          break;
      }
    },
  };
}

/**
 * Get the DevTools API if available
 */
export function getDevToolsAPI(): DevToolsAPI | null {
  if (typeof window !== 'undefined') {
    return window[DEVTOOLS_WINDOW_KEY] || null;
  }
  return null;
}

/**
 * Check if DevTools are enabled
 */
export function isDevToolsEnabled(): boolean {
  const api = getDevToolsAPI();
  return api?.enabled ?? false;
}