/**
 * Canvas Adapter - Reference Implementation
 *
 * This module demonstrates how to build a custom NodeAdapter for non-DOM targets.
 * The canvas adapter creates a scene graph that renders to an HTML canvas element
 * via the Canvas 2D API.
 *
 * Key concepts demonstrated:
 * - Implementing the Renderer (NodeAdapter) interface
 * - Bridge elements that connect different rendering contexts
 * - Scene graph management with parent/child relationships
 * - Dirty tracking and batched repainting
 * - Hit testing for interactive canvas applications
 *
 * This is meant as a learning resource and starting point for building custom
 * adapters. For production canvas applications, consider using established
 * libraries like Konva or PixiJS.
 */

import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions,
  defaultHelpers,
} from '@lattice/view/presets/core';
import type { ReactiveAdapter, RefSpec, Adapter } from '@lattice/view/types';
import {
  createCanvasAdapter,
  type CanvasAdapterOptions,
} from './adapter';
import { createCanvasAddEventListener } from './addEventListener';
import type { CanvasAdapterConfig } from './types';

export { createCanvasAdapter } from './adapter';
export { createCanvasAddEventListener } from './addEventListener';
export type {
  CanvasAdapterOptions,
  CanvasAdapterInstance,
} from './adapter';
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
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createDOMViewSvc } from '@lattice/view/presets/dom';
 * import { createCanvasViewSvc } from './canvas-adapter';
 *
 * const signals = createSignalsApi();
 * const dom = createDOMViewSvc(signals);
 * const canvas = createCanvasViewSvc(signals, { clearColor: '#16213e' });
 *
 * export const { signal, computed } = signals;
 * export { dom, canvas };
 * ```
 */
export const createCanvasViewSvc = (
  signals: ReactiveAdapter,
  options: CanvasAdapterOptions = {}
) => {
  const adapter = createCanvasAdapter(options);
  const viewHelpers = defaultHelpers<CanvasAdapterConfig>(
    adapter as Adapter<CanvasAdapterConfig>,
    signals
  );
  const viewSvc = composeFrom(
    defaultExtensions<CanvasAdapterConfig>(),
    viewHelpers
  );

  const svc = {
    ...viewSvc,
    adapter,
    on: createCanvasAddEventListener(adapter, signals.batch),
  };

  return {
    ...svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

export type CanvasViewSvc = ReturnType<typeof createCanvasViewSvc>;
