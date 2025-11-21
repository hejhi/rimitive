/**
 * Instrumentation wrapper for signal primitives
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { SignalFunction } from '../signal';

/**
 * Instrument a signal factory to emit events
 */
export function instrumentSignal(
  impl: <T>(value: T) => SignalFunction<T>,
  instrumentation: InstrumentationContext
) {
  return function instrumentedCreateSignal<T>(
    initialValue: T
  ): SignalFunction<T> {
    const signal = impl(initialValue);
    const { id } = instrumentation.register(
      signal,
      'signal',
      `Signal<${typeof initialValue}>`
    );

    // Wrap the signal to emit events
    function instrumentedSignal(value?: T): T | void {
      if (!arguments.length) {
        // Read - emit read event
        const currentValue = signal();

        instrumentation.emit({
          type: 'SIGNAL_READ',
          timestamp: Date.now(),
          data: {
            signalId: id,
            value: currentValue,
          },
        });

        return currentValue;
      }

      // Write - emit write event BEFORE the write
      const oldValue = signal.peek();

      instrumentation.emit({
        type: 'SIGNAL_WRITE',
        timestamp: Date.now(),
        data: {
          signalId: id,
          oldValue,
          newValue: value,
        },
      });

      signal(value!);
    }

    // Copy over peek with proper binding
    instrumentedSignal.peek = () => signal.peek();

    return instrumentedSignal as SignalFunction<T>;
  };
}
