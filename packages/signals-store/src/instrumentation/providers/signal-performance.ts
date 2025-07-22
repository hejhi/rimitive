/**
 * Signal-specific performance instrumentation provider
 * 
 * Extends the base performance provider with signal-specific metrics
 */

import type { InstrumentationProvider, InstrumentationEvent } from '@lattice/lattice';
import { performanceProvider, type PerformanceProviderOptions } from '@lattice/lattice';

/**
 * Create a signal-aware performance instrumentation provider
 */
export function signalPerformanceProvider(options: PerformanceProviderOptions = {}): InstrumentationProvider {
  const baseProvider = performanceProvider(options);
  const { logAll = false, logger = console.log } = options;
  
  return {
    ...baseProvider,
    
    emit(event: InstrumentationEvent): void {
      // Handle signal-specific events
      if (event.type === 'SIGNAL_WRITE' && logAll) {
        const name = event.data.name;
        const signalName = typeof name === 'string' ? name : 'unnamed';
        logger(
          `[Performance] Signal write: ${signalName}`,
          {
            oldValue: event.data.oldValue,
            newValue: event.data.newValue
          }
        );
      } else {
        // Delegate to base provider for other events
        baseProvider.emit(event);
      }
    }
  };
}