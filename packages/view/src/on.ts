/**
 * Event listener helper with automatic cleanup
 *
 * PATTERN: Simple primitive that wraps addEventListener with cleanup
 * Returns unsubscribe function for manual cleanup or use in lifecycle callbacks
 */

/**
 * Attach an event listener to an element with automatic type inference
 * Returns unsubscribe function to remove the listener
 *
 * @example
 * ```ts
 * const btn = el(['button', 'Click me']);
 * btn((element) => {
 *   const unsub = on(element, 'click', (e) => console.log('clicked'));
 *   return unsub; // Cleanup when element is removed
 * });
 * ```
 *
 * @example
 * ```ts
 * // Type-safe event inference
 * const input = el(['input', { type: 'text' }]);
 * input((element) => {
 *   return on(element, 'input', (e) => {
 *     // e is typed as InputEvent
 *     const value = (e.target as HTMLInputElement).value;
 *   });
 * });
 * ```
 */
export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  element.addEventListener(event, handler as EventListener, options);
  return () => element.removeEventListener(event, handler as EventListener, options);
}

/**
 * Helper to attach multiple event listeners with a single cleanup
 * Provides an `on` function scoped to the element
 * Returns the ElementRef to allow chaining lifecycle callbacks
 *
 * @example
 * ```ts
 * const input = listener(
 *   el(['input', { type: 'text' }]),
 *   (on) => {
 *     on('input', (e) => {
 *       inputValue((e.target as HTMLInputElement).value);
 *     });
 *     on('keydown', (e) => {
 *       if (e.key === 'Enter') handleSubmit();
 *     });
 *   }
 * );
 * // Can still add more lifecycle callbacks:
 * input((el) => console.log('connected!'));
 * ```
 */
export function listener<TElement extends HTMLElement>(
  elementRef: (callback: (element: TElement) => void | (() => void)) => TElement,
  setup: (on: <K extends keyof HTMLElementEventMap>(
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => void) => void
): typeof elementRef {
  elementRef((element) => {
    const cleanups: Array<() => void> = [];

    // Scoped on function that automatically adds cleanups
    const scopedOn = <K extends keyof HTMLElementEventMap>(
      event: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ): void => {
      cleanups.push(on(element, event, handler, options));
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
