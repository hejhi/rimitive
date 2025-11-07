/**
 * Instrumentation wrapper for on primitive
 */

import type { InstrumentationContext } from '@lattice/lattice';
import type { OnFactory } from '../on';

/**
 * Instrument an on factory to emit events
 */
export function instrumentOn(
  method: OnFactory['method'],
  instrumentation: InstrumentationContext
): OnFactory['method'] {
  return function instrumentedOn<K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): (element: HTMLElement) => () => void {
    const listenerId = crypto.randomUUID();

    instrumentation.emit({
      type: 'ON_CREATED',
      timestamp: Date.now(),
      data: {
        listenerId,
        event,
        hasOptions: !!options,
        capture: typeof options === 'object' ? options.capture : options,
      },
    });

    // Wrap the lifecycle callback to track attachment/detachment
    return (element: HTMLElement): () => void => {
      instrumentation.emit({
        type: 'ON_ATTACHED',
        timestamp: Date.now(),
        data: {
          listenerId,
          event,
          elementType: element.tagName?.toLowerCase(),
        },
      });

      // Track event fires
      let eventCount = 0;
      const instrumentedHandler = (e: HTMLElementEventMap[K]) => {
        eventCount++;

        instrumentation.emit({
          type: 'ON_EVENT_FIRED',
          timestamp: Date.now(),
          data: {
            listenerId,
            event,
            eventCount,
          },
        });

        handler(e);
      };

      // Attach with instrumented handler via the original lifecycle callback
      // We need to create a new lifecycle callback that uses our instrumented handler
      const wrappedLifecycleCallback = method(event, instrumentedHandler as typeof handler, options);
      const cleanup = wrappedLifecycleCallback(element);

      // Wrap cleanup to emit detachment event
      return () => {
        instrumentation.emit({
          type: 'ON_DETACHED',
          timestamp: Date.now(),
          data: {
            listenerId,
            event,
            totalEventsFired: eventCount,
          },
        });

        cleanup();
      };
    };
  };
}
