/**
 * Instrumentation wrappers for signal primitives
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { SignalFunction } from './signal';
import type { ComputedFunction } from './computed';

/**
 * Instrument a signal factory to emit events
 */
export function instrumentSignal(
  method: <T>(value: T) => SignalFunction<T>,
  instrumentation: InstrumentationContext
) {
  return function instrumentedCreateSignal<T>(initialValue: T): SignalFunction<T> {
    const signal = method(initialValue);
    const { id } = instrumentation.register(signal, 'signal', `Signal<${typeof initialValue}>`);

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

      // Write - emit write event
      const oldValue = signal.peek();
      signal(value!);

      instrumentation.emit({
        type: 'SIGNAL_WRITE',
        timestamp: Date.now(),
        data: {
          signalId: id,
          oldValue,
          newValue: value,
        },
      });
    }

    // Copy over peek with proper binding
    instrumentedSignal.peek = () => signal.peek();

    return instrumentedSignal as SignalFunction<T>;
  };
}

/**
 * Instrument a computed factory to emit events
 */
export function instrumentComputed(
  method: <T>(compute: () => T) => ComputedFunction<T>,
  instrumentation: InstrumentationContext
) {
  return function instrumentedCreateComputed<T>(compute: () => T): ComputedFunction<T> {
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

/**
 * Instrument an effect factory to emit events
 */
export function instrumentEffect(
  method: (fn: () => void | (() => void)) => () => void,
  instrumentation: InstrumentationContext
) {
  return function instrumentedCreateEffect(fn: () => void | (() => void)): () => void {
    const effectId = crypto.randomUUID();
    instrumentation.register(fn, 'effect', 'Effect');

    instrumentation.emit({
      type: 'EFFECT_CREATED',
      timestamp: Date.now(),
      data: {
        effectId,
      },
    });

    // Wrap the effect function to track executions
    const wrappedFn = () => {
      instrumentation.emit({
        type: 'EFFECT_RUN_START',
        timestamp: Date.now(),
        data: {
          effectId,
        },
      });

      const result = fn();

      instrumentation.emit({
        type: 'EFFECT_RUN_END',
        timestamp: Date.now(),
        data: {
          effectId,
        },
      });

      return result;
    };

    const dispose = method(wrappedFn);

    // Wrap dispose to emit disposal event
    return () => {
      instrumentation.emit({
        type: 'EFFECT_DISPOSED',
        timestamp: Date.now(),
        data: {
          effectId,
        },
      });

      dispose();
    };
  };
}
