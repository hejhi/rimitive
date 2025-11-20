/**
 * Instrumentation wrapper for computed primitives
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { ComputedFunction } from '../computed';

/**
 * Instrument a computed factory to emit events
 */
export function instrumentComputed(
  method: <T>(compute: () => T) => ComputedFunction<T>,
  instrumentation: InstrumentationContext
) {
  return function instrumentedCreateComputed<T>(
    compute: () => T
  ): ComputedFunction<T> {
    const computed = method(compute);
    const { id } = instrumentation.register(computed, 'computed', 'Computed');

    // Wrap to emit computation events
    function instrumentedComputed(): T {
      instrumentation.emit({
        type: 'COMPUTED_READ',
        timestamp: Date.now(),
        data: {
          computedId: id,
        },
      });

      const value = computed();

      instrumentation.emit({
        type: 'COMPUTED_VALUE',
        timestamp: Date.now(),
        data: {
          computedId: id,
          value,
        },
      });

      return value;
    }

    // Copy over peek with proper binding
    instrumentedComputed.peek = () => computed.peek();

    return instrumentedComputed as ComputedFunction<T>;
  };
}
