/**
 * Event listener helper with automatic cleanup and batching
 *
 * Wraps addEventListener with cleanup and automatic batching for performance.
 * When multiple signals are updated in an event handler, batching ensures
 * only one re-render happens instead of multiple.
 */

import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';

/**
 * Options for creating on factory
 */
export type OnOpts = {
  batch: <T>(fn: () => T) => T;
};

export type OnProps = {
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
 * On primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 */
export const On = create(({ batch }: OnOpts) => (props?: OnProps) => {
  const { instrument } = props ?? {};

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
      const batchedHandler = (e: HTMLElementEventMap[K]) => batch(() => handler(e));

      element.addEventListener(event, batchedHandler as EventListener, options);
      return () =>
        element.removeEventListener(
          event,
          batchedHandler as EventListener,
          options
        );
    };
  }

  const extension: OnFactory = {
    name: 'on',
    method: on,
    ...(instrument && { instrument }),
  };

  return extension;
});
