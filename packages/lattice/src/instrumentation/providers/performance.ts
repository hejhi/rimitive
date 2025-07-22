/**
 * Performance instrumentation provider
 * 
 * Logs performance metrics for computations and effects
 */

import type { InstrumentationProvider, InstrumentationEvent } from '../types';

export interface PerformanceProviderOptions {
  /**
   * Minimum duration in milliseconds to log
   */
  threshold?: number;
  
  /**
   * Log all events, not just slow ones
   */
  logAll?: boolean;
  
  /**
   * Custom logger function
   */
  logger?: (message: string, data: any) => void;
}

/**
 * Create a performance instrumentation provider
 */
export function performanceProvider(options: PerformanceProviderOptions = {}): InstrumentationProvider {
  const {
    threshold = 16, // Default to one frame (60fps)
    logAll = false,
    logger = console.log
  } = options;
  
  const metrics = new Map<string, { count: number; totalDuration: number }>();
  
  return {
    name: 'performance',
    
    init(contextId: string, contextName: string): void {
      logger(`[Performance] Monitoring context: ${contextName} (${contextId})`);
    },
    
    emit(event: InstrumentationEvent): void {
      switch (event.type) {
        case 'COMPUTE_END':
        case 'EFFECT_END': {
          const duration = event.data.duration as number;
          const name = event.data.name as string || 'unnamed';
          const type = event.type.replace('_END', '').toLowerCase();
          
          // Update metrics
          const key = `${type}:${name}`;
          const current = metrics.get(key) || { count: 0, totalDuration: 0 };
          current.count++;
          current.totalDuration += duration;
          metrics.set(key, current);
          
          // Log if slow or logAll is enabled
          if (duration >= threshold || logAll) {
            logger(
              `[Performance] Slow ${type}: ${name} took ${duration.toFixed(2)}ms`,
              {
                id: event.data.id,
                contextId: event.contextId,
                avgDuration: (current.totalDuration / current.count).toFixed(2),
                count: current.count
              }
            );
          }
          break;
        }
        
        case 'SIGNAL_WRITE': {
          if (logAll) {
            logger(
              `[Performance] Signal write: ${event.data.name || 'unnamed'}`,
              {
                oldValue: event.data.oldValue,
                newValue: event.data.newValue
              }
            );
          }
          break;
        }
      }
    },
    
    register<T>(resource: T, _type: string, _name?: string): { id: string; resource: T } {
      return { id: crypto.randomUUID(), resource };
    },
    
    dispose(): void {
      // Log summary metrics
      if (metrics.size > 0) {
        logger('[Performance] Summary:');
        metrics.forEach((data, key) => {
          logger(`  ${key}: ${data.count} calls, avg ${(data.totalDuration / data.count).toFixed(2)}ms`);
        });
        metrics.clear();
      }
    }
  };
}