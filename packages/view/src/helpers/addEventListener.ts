/**
 * Event listener helper with automatic cleanup and batching
 *
 * Wraps addEventListener with cleanup and automatic batching for performance.
 * When multiple signals are updated in an event handler, batching ensures
 * only one re-render happens instead of multiple.
 */

/**
 * Creates an addEventListener helper that automatically batches signal updates
 *
 * @param batch - Batch function from signals API
 * @returns addEventListener helper function
 */
export const createAddEventListener = (batch: <T>(fn: () => T) => T) => {
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

      element.addEventListener(event, batchedHandler as EventListener, options);
      return () =>
        element.removeEventListener(
          event,
          batchedHandler as EventListener,
          options
        );
    };
  };
};
