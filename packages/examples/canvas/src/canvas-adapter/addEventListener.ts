/**
 * Canvas event listener helper with automatic cleanup and hit testing
 *
 * Attaches event listeners to the canvas element and provides hit-tested
 * CanvasPointerEvent with the target node under the pointer.
 *
 * Usage:
 * ```typescript
 * canvas.el('canvas').props({ width: 600, height: 400 })(
 *   canvas.el('circle').props({ x: 100, y: 100, radius: 50 })()
 * )(
 *   addEventListener('pointerdown', (e) => {
 *     if (e.target) {
 *       console.log('Clicked on:', e.target.type);
 *     }
 *   })
 * )
 * ```
 */

import type { CanvasBridgeElement, CanvasPointerEvent } from './types';
import type { HitTestFn } from './adapter';

/**
 * Canvas event types that support hit testing
 */
export type CanvasEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'click';

/**
 * Creates a canvas addEventListener helper with hit testing
 *
 * @param hitTest - Hit test function for determining which canvas node is under a point
 * @param batch - Batch function from signals service for automatic batching
 * @returns addEventListener helper function
 */
export const createCanvasAddEventListener = (
  hitTest: HitTestFn,
  batch: <T>(fn: () => T) => T
) => {
  /**
   * Curried event listener attachment with hit testing and batching
   */
  return function addEventListener(
    event: CanvasEventType,
    handler: (event: CanvasPointerEvent) => void
  ): (element: CanvasBridgeElement) => () => void {
    return (bridge: CanvasBridgeElement) => {
      // Helper to convert native event to canvas coordinates
      const getCanvasCoordinates = (
        e: PointerEvent | MouseEvent
      ): { x: number; y: number } => {
        const rect = bridge.getBoundingClientRect();
        const scaleX = bridge.width / rect.width;
        const scaleY = bridge.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      };

      // Helper to create CanvasPointerEvent with hit testing
      const createCanvasEvent = (
        e: PointerEvent | MouseEvent
      ): CanvasPointerEvent => {
        const coords = getCanvasCoordinates(e);
        return {
          x: coords.x,
          y: coords.y,
          target: hitTest(bridge, coords.x, coords.y),
          nativeEvent: e as PointerEvent,
        };
      };

      // Wrap handler with batching and hit testing
      const wrappedHandler = (e: PointerEvent | MouseEvent) => {
        const canvasEvent = createCanvasEvent(e);
        batch(() => handler(canvasEvent));
      };

      // Map canvas event types to native event types
      const nativeEvent = event === 'click' ? 'click' : event;

      bridge.addEventListener(nativeEvent, wrappedHandler as EventListener);
      return () =>
        bridge.removeEventListener(
          nativeEvent,
          wrappedHandler as EventListener
        );
    };
  };
};
