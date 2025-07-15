/**
 * DevTools API management
 * 
 * This module manages the global DevTools API exposed on the window object
 * for communication with browser extensions.
 */

import type { DevToolsAPI, DevToolsEvent } from '../types';
import { DEVTOOLS_VERSION, DEVTOOLS_WINDOW_KEY, MESSAGE_SOURCE } from '../constants';
import type { EventEmitter } from './emitter';

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

// Track all API manager instances for aggregation
const allManagers: DevToolsAPIManager[] = [];
let globalAPIInitialized = false;

/**
 * DevTools API manager
 */
export class DevToolsAPIManager {
  private contexts = new Map<string, ContextMetadata>();
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
    // Register this instance globally
    allManagers.push(this);
  }

  /**
   * Initialize the DevTools API
   */
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

    // Expose on window
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)[DEVTOOLS_WINDOW_KEY] = api;
      
      // Notify extension that DevTools are available
      window.postMessage({
        source: MESSAGE_SOURCE,
        type: 'INIT',
        payload: {
          enabled: true,
          version: DEVTOOLS_VERSION,
        }
      }, '*');
    }
  }

  /**
   * Register a new context
   */
  registerContext(id: string, name: string): void {
    this.contexts.set(id, {
      id,
      name,
      created: Date.now(),
      signalCount: 0,
      computedCount: 0,
      effectCount: 0,
    });
  }

  /**
   * Unregister a context
   */
  unregisterContext(id: string): void {
    this.contexts.delete(id);
  }

  /**
   * Update context counts
   */
  updateContextCount(
    contextId: string,
    type: 'signal' | 'computed' | 'effect',
    delta: number = 1
  ): void {
    const context = this.contexts.get(contextId);
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
  }

  /**
   * Get the DevTools API if available
   */
  static getAPI(): DevToolsAPI | null {
    if (typeof window !== 'undefined') {
      const api = (window as unknown as Record<string, unknown>)[DEVTOOLS_WINDOW_KEY];
      return (api as DevToolsAPI) || null;
    }
    return null;
  }

  /**
   * Check if DevTools are enabled
   */
  static isEnabled(): boolean {
    const api = DevToolsAPIManager.getAPI();
    return api?.enabled ?? false;
  }
}