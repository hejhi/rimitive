/**
 * DevTools instrumentation provider for Lattice
 * 
 * This provider sends instrumentation events to the browser DevTools extension
 */

import type { InstrumentationProvider, InstrumentationEvent } from '../types';

export interface DevtoolsProviderOptions {
  /**
   * Enable console logging for debugging
   */
  debug?: boolean;
}

/**
 * Create a DevTools instrumentation provider
 */
export function devtoolsProvider(options: DevtoolsProviderOptions = {}): InstrumentationProvider {
  const { debug = false } = options;
  
  return {
    name: 'lattice-devtools',
    
    init(contextId: string, contextName: string): void {
      if (typeof window === 'undefined') return;
      
      // Announce that Lattice is being used
      window.postMessage({
        source: 'lattice-devtools',
        type: 'LATTICE_DETECTED',
        payload: {
          enabled: true,
          version: '1.0.0'
        }
      }, '*');
      
      // Emit context creation event
      this.emit({
        type: 'CONTEXT_CREATED',
        timestamp: Date.now(),
        data: {
          id: contextId,
          name: contextName
        }
      });
      
      if (debug) {
        console.log('[Lattice DevTools] Initialized for context:', contextName, contextId);
      }
    },
    
    emit(event: InstrumentationEvent): void {
      if (typeof window === 'undefined') return;
      
      window.postMessage({
        source: 'lattice-devtools',
        type: 'EVENT',
        payload: event
      }, '*');
      
      if (debug) {
        console.log('[Lattice DevTools] Event:', event.type, event.data);
      }
    },
    
    register<T>(resource: T, type: string, name?: string): { id: string; resource: T } {
      const id = crypto.randomUUID();
      
      if (debug) {
        console.log('[Lattice DevTools] Registered:', type, name, id);
      }
      
      return { id, resource };
    },
    
    dispose(): void {
      if (debug) {
        console.log('[Lattice DevTools] Provider disposed');
      }
    }
  };
}

/**
 * Check if DevTools is available in the current environment
 */
export function isDevtoolsAvailable(): boolean {
  return typeof window !== 'undefined' && '__LATTICE_DEVTOOLS__' in window;
}