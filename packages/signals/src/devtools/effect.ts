/**
 * Instrumentation wrapper for effect primitives
 */

import type { InstrumentationContext } from '@lattice/lattice';

/**
 * Instrument an effect factory to emit events
 */
export function instrumentEffect(
  method: (fn: () => void | (() => void)) => () => void,
  instrumentation: InstrumentationContext
) {
  return function instrumentedCreateEffect(
    fn: () => void | (() => void)
  ): () => void {
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
