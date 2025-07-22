/**
 * Example: Creating a custom instrumentation provider
 * 
 * This shows how third parties can create their own instrumentation
 * providers for Lattice applications.
 */

import type { InstrumentationProvider, InstrumentationEvent } from '@lattice/store';

/**
 * Example: Analytics provider that sends events to an analytics service
 */
export function analyticsProvider(apiKey: string): InstrumentationProvider {
  const events: InstrumentationEvent[] = [];
  let flushTimer: number | undefined;
  
  const flush = () => {
    if (events.length === 0) return;
    
    // In a real implementation, this would send to your analytics API
    console.log(`[Analytics] Sending ${events.length} events to analytics service`);
    console.table(events.map(e => ({ type: e.type, timestamp: e.timestamp })));
    
    events.length = 0;
  };
  
  return {
    name: 'analytics',
    
    init(contextId: string, contextName: string): void {
      console.log(`[Analytics] Tracking context: ${contextName} (${contextId})`);
      
      // Batch events and send every 5 seconds
      flushTimer = setInterval(flush, 5000) as unknown as number;
    },
    
    emit(event: InstrumentationEvent): void {
      // Filter only the events we care about for analytics
      if (event.type === 'SIGNAL_WRITE' || event.type === 'EFFECT_RUN') {
        events.push(event);
        
        // Flush immediately if we have too many events
        if (events.length >= 100) {
          flush();
        }
      }
    },
    
    register<T>(resource: T, _type: string, _name?: string): { id: string; resource: T } {
      // Analytics doesn't need to track resources
      return { id: crypto.randomUUID(), resource };
    },
    
    dispose(): void {
      // Clean up timer and flush remaining events
      if (flushTimer !== undefined) {
        clearInterval(flushTimer);
      }
      flush();
    }
  };
}

/**
 * Example: Memory leak detector
 */
export function memoryLeakDetector(): InstrumentationProvider {
  const resources = new Map<string, { type: string; name?: string; created: number }>();
  const disposed = new Set<string>();
  
  return {
    name: 'memory-leak-detector',
    
    init(_contextId: string, _contextName: string): void {
      console.log('[Memory Leak Detector] Monitoring resource lifecycle');
    },
    
    emit(event: InstrumentationEvent): void {
      // Track resource creation
      if (event.type.endsWith('_CREATED') && event.data.id) {
        const id = event.data.id as string;
        resources.set(id, {
          type: event.type.replace('_CREATED', ''),
          name: event.data.name as string | undefined,
          created: event.timestamp
        });
      }
      
      // Track resource disposal
      if (event.type.endsWith('_DISPOSED') && event.data.id) {
        const id = event.data.id as string;
        disposed.add(id);
        resources.delete(id);
      }
    },
    
    register<T>(resource: T, type: string, name?: string): { id: string; resource: T } {
      const id = crypto.randomUUID();
      resources.set(id, { type, name, created: Date.now() });
      return { id, resource };
    },
    
    dispose(): void {
      // Report potential leaks
      const leaks = Array.from(resources.entries())
        .filter(([id]) => !disposed.has(id))
        .map(([id, info]) => ({
          id,
          ...info,
          age: Date.now() - info.created
        }));
      
      if (leaks.length > 0) {
        console.warn('[Memory Leak Detector] Potential leaks detected:');
        console.table(leaks);
      } else {
        console.log('[Memory Leak Detector] No leaks detected');
      }
      
      resources.clear();
      disposed.clear();
    }
  };
}

// Usage example:
/*
import { withInstrumentation, signalExtension } from '@lattice/store';
import { analyticsProvider, memoryLeakDetector } from './custom-providers';

const ctx = withInstrumentation({
  providers: [
    analyticsProvider('your-api-key'),
    memoryLeakDetector()
  ],
  enabled: import.meta.env.DEV
}, signalExtension, computedExtension);
*/