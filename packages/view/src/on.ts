/**
 * Event listener helper with automatic cleanup and batching
 *
 * Wraps addEventListener with cleanup and automatic batching for performance.
 * When multiple signals are updated in an event handler, batching ensures
 * only one re-render happens instead of multiple.
 */

import type { LatticeExtension } from '@lattice/lattice';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import type { RefSpec } from './types';

/**
 * Options for creating on factory
 */
export type OnOpts = {
  startBatch: Scheduler['startBatch'];
  endBatch: Scheduler['endBatch'];
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
 *
 * @example
 * ```ts
 * const onFactory = createOnFactory({ startBatch, endBatch });
 * const on = onFactory.method;
 *
 * const btn = el(['button', 'Click me']);
 * btn((element) => {
 *   const unsub = on(element, 'click', (e) => console.log('clicked'));
 *   return unsub; // Cleanup when element is removed
 * });
 * ```
 *
 * @example
 * ```ts
 * // Type-safe event inference with automatic batching
 * const input = el(['input', { type: 'text' }]);
 * input((element) => {
 *   return on(element, 'input', (e) => {
 *     // e is typed as InputEvent
 *     // Multiple signal updates here will trigger only one re-render
 *     signal1.set((e.target as HTMLInputElement).value);
 *     signal2.set(Date.now());
 *   });
 * });
 * ```
 */
export function createOnFactory({ startBatch, endBatch }: OnOpts): OnFactory {
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

  return {
    name: 'on',
    method: on,
  };
}

/**
 * Factory return type for listener function
 */
export type ListenerFactory = LatticeExtension<
  'listener',
  <TElement extends HTMLElement>(
    elementRef: RefSpec<TElement>,
    setup: (on: <K extends keyof HTMLElementEventMap>(
      event: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ) => void) => void
  ) => RefSpec<TElement>
>;

/**
 * Create the listener helper factory

 */
export function createListenerFactory({ startBatch, endBatch }: OnOpts): ListenerFactory {
  function listener<TElement extends HTMLElement>(
    elementRef: RefSpec<TElement>,
    setup: (on: <K extends keyof HTMLElementEventMap>(
      event: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ) => void) => void
  ): RefSpec<TElement> {
    elementRef((element) => {
      const cleanups: Array<() => void> = [];

      // Scoped on function that automatically adds cleanups and batching
      const scopedOn = <K extends keyof HTMLElementEventMap>(
        event: K,
        handler: (event: HTMLElementEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
      ): void => {
        // Wrap handler with batching
        const batchedHandler = withBatch({ startBatch, endBatch }, handler);

        element.addEventListener(event, batchedHandler as EventListener, options);
        cleanups.push(() => element.removeEventListener(event, batchedHandler as EventListener, options));
      };

      // Run setup to collect all listeners
      setup(scopedOn);

      // Return combined cleanup
      return () => {
        for (const cleanup of cleanups) cleanup();
      };
    });

    // Return the ref to allow chaining
    return elementRef;
  }

  return {
    name: 'listener',
    method: listener,
  };
}
