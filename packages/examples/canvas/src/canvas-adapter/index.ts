/**
 * Canvas Adapter - Reference Implementation
 *
 * This module demonstrates how to build a custom NodeAdapter for non-DOM targets.
 * The canvas adapter creates a scene graph that renders to an HTML canvas element
 * via the Canvas 2D API.
 *
 * Key concepts demonstrated:
 * - Implementing the Renderer (NodeAdapter) type
 * - Bridge elements that connect different rendering contexts
 * - Scene graph management with parent/child relationships
 * - Dirty tracking and batched repainting
 * - Hit testing for interactive canvas applications
 *
 * This is meant as a learning resource and starting point for building custom
 * adapters. For production canvas applications, consider using established
 * libraries like Konva or PixiJS.
 */

import { createView } from '@lattice/view/presets/core';
import type { RefSpec } from '@lattice/view/types';
import { createCanvasAdapter, type CanvasAdapterOptions } from './adapter';
import { createCanvasAddEventListener } from './addEventListener';
import { Use } from '@lattice/lattice';
import { SignalsSvc } from '@lattice/signals';

export { createCanvasAdapter } from './adapter';
export { createCanvasAddEventListener } from './addEventListener';
export type { CanvasAdapterOptions, HitTestFn } from './adapter';
export type { CanvasEventType } from './addEventListener';
export type {
  CanvasNode,
  CanvasBridgeElement,
  CanvasElement,
  CanvasAdapterConfig,
  CanvasPointerEvent,
  // Props types
  CanvasProps,
  GroupProps,
  RectProps,
  CircleProps,
  LineProps,
  PathProps,
  TextProps,
  ImageProps,
} from './types';

/**
 * Create a canvas view service (view primitives for canvas adapter)
 *
 * Use with shared signals for multi-adapter apps (DOM + Canvas).
 *
 * @example
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 * import { createDOMView } from '@lattice/view/presets/dom';
 * import { createCanvasViewSvc } from './canvas-adapter';
 *
 * const signals = createSignals();
 * const dom = createDOMView(signals);
 * const canvas = createCanvasViewSvc(signals, { clearColor: '#16213e' });
 *
 * export const { signal, computed } = signals;
 * export { dom, canvas };
 * ```
 */
export const createCanvasViewSvc = (
  {
    signals,
  }: {
    signals: Use<SignalsSvc>;
  },
  options: CanvasAdapterOptions
) => {
  const { adapter, hitTest } = createCanvasAdapter(options);
  const viewSvc = createView({ adapter, signals })();

  const svc = {
    ...viewSvc,
    on: createCanvasAddEventListener(hitTest, viewSvc.batch),
  };

  return {
    ...svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

export type CanvasViewSvc = ReturnType<typeof createCanvasViewSvc>;
