/**
 * Event listener helper with automatic cleanup and batching
 *
 * Wraps addEventListener with cleanup and automatic batching for performance.
 * When multiple signals are updated in an event handler, batching ensures
 * only one re-render happens instead of multiple.
 */

import { defineModule } from '@lattice/lattice';
import { BatchModule } from '@lattice/signals/batch';

/**
 * Type of the addEventListener helper returned by createAddEventListener
 *
 * @example
 * ```typescript
 * import type { AddEventListener } from '@lattice/view/deps/addEventListener';
 *
 * const on: AddEventListener = createAddEventListener(batch);
 *
 * el('button').ref(
 *   on('click', (e) => {
 *     count(c => c + 1);
 *     loading(true);
 *     // Both updates batched into a single render
 *   })
 * )('Click me');
 * ```
 */
export type AddEventListener = <K extends keyof HTMLElementEventMap>(
  event: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
) => (element: HTMLElement) => () => void;

/**
 * Creates an addEventListener helper that automatically batches signal updates
 *
 * @param batch - Batch function from signals service
 * @returns addEventListener helper function
 *
 * @example
 * ```typescript
 * import { createAddEventListener } from '@lattice/view/deps/addEventListener';
 * import { createSignals } from '@lattice/signals/presets/core';
 * import { createDOMView } from '@lattice/view/presets/dom';
 *
 * const signals = createSignals();
 * const view = createDOMView({ signals });
 * const { batch, el, signal } = view();
 * const on = createAddEventListener(batch);
 *
 * const count = signal(0);
 * const loading = signal(false);
 *
 * el('button').ref(
 *   on('click', () => {
 *     count(c => c + 1);
 *     loading(true);
 *     // Both updates batched automatically
 *   })
 * )('Increment');
 * ```
 */
export const createAddEventListener = (
  batch: <T>(fn: () => T) => T
): AddEventListener => {
  /**
   * Curried event listener attachment with automatic batching
   *
   * Usage:
   * ```typescript
   * el('button')('Click me')(
   *   addEventListener('click', (e) => {
   *     count(count() + 1); // Automatically batched
   *   })
   * )
   * ```
   */
  return function addEventListener<K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      // Wrap handler with batching for automatic performance optimization
      const batchedHandler = (e: HTMLElementEventMap[K]) =>
        batch(() => handler(e));

      element.addEventListener(event, batchedHandler, options);
      return () => element.removeEventListener(event, batchedHandler, options);
    };
  };
};

/**
 * On module - provides the `on` event listener helper.
 * Depends on BatchModule for automatic batching of signal updates in handlers.
 */
export const OnModule = defineModule({
  name: 'on',
  dependencies: [BatchModule],
  create: ({ batch }) => createAddEventListener(batch),
});
