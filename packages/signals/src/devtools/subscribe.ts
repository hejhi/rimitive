/**
 * Instrumentation wrapper for subscribe primitives
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { SubscribeFunction, SubscribeCallback } from '../subscribe';

/**
 * Instrument a subscribe factory to emit events
 */
export function instrumentSubscribe(
  impl: SubscribeFunction,
  instrumentation: InstrumentationContext
): SubscribeFunction {
  return function instrumentedSubscribe<T>(
    source: () => T,
    callback: SubscribeCallback<T>
  ) {
    // Create subscription ID
    const subscriptionId = crypto.randomUUID();

    instrumentation.emit({
      type: 'SUBSCRIBE_CREATED',
      timestamp: Date.now(),
      data: {
        subscriptionId,
      },
    });

    // Wrap the callback to emit events
    const instrumentedCallback: SubscribeCallback<T> = (value: T) => {
      instrumentation.emit({
        type: 'SUBSCRIBE_CALLBACK_START',
        timestamp: Date.now(),
        data: {
          subscriptionId,
          value,
        },
      });

      callback(value);

      instrumentation.emit({
        type: 'SUBSCRIBE_CALLBACK_END',
        timestamp: Date.now(),
        data: {
          subscriptionId,
        },
      });
    };

    // Create the actual subscription
    const unsubscribe = impl(source, instrumentedCallback);

    // Wrap unsubscribe to emit disposal event
    return () => {
      instrumentation.emit({
        type: 'SUBSCRIBE_DISPOSED',
        timestamp: Date.now(),
        data: {
          subscriptionId,
        },
      });

      unsubscribe();
    };
  };
}
