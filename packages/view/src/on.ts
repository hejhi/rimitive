/**
 * Event listener helper with automatic cleanup and batching
 *
 * Wraps addEventListener with cleanup and automatic batching for performance.
 * When multiple signals are updated in an event handler, batching ensures
 * only one re-render happens instead of multiple.
 */

import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';

/**
 * Options for creating on factory
 */
export type OnOpts = {
  startBatch: Scheduler['startBatch'];
  endBatch: Scheduler['endBatch'];
  instrument?: (
    method: OnFactory['method'],
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => OnFactory['method'];
};

/**
 * Factory return type for on function - curried version
 * First call: on(event, handler, options?) returns a lifecycle callback
 * The lifecycle callback accepts an element and returns cleanup
 */
export type OnFactory = LatticeExtension<
  'on',
  <K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => (element: HTMLElement) => () => void
>;

/**
 * Utility to wrap a function with batching
 * Ensures all signal updates in the function trigger one re-render
 */
export function withBatch<TArgs extends unknown[], TReturn>(
  scheduler: Pick<Scheduler, 'startBatch' | 'endBatch'>,
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return (...args: TArgs) => {
    scheduler.startBatch();
    try {
      return fn(...args);
    } finally {
      scheduler.endBatch();
    }
  };
}

/**
 * Create the on primitive factory
 */
export function createOnFactory({ startBatch, endBatch, instrument }: OnOpts): OnFactory {
  /**
   * Curried event listener attachment with automatic batching
   */
  function on<K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      // Wrap handler with batching for automatic performance optimization
      const batchedHandler = withBatch({ startBatch, endBatch }, handler);

      element.addEventListener(event, batchedHandler as EventListener, options);
      return () => element.removeEventListener(event, batchedHandler as EventListener, options);
    };
  }

  const extension: OnFactory = {
    name: 'on',
    method: on,
    ...(instrument && { instrument }),
  };

  return extension;
}

/**
 * On primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 */
export const On = create((opts: OnOpts) => () => createOnFactory(opts));
