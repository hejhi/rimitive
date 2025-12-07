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

import { createViewSvc } from '@lattice/view/presets/core';
import type { RefSpec, Readable, Writable } from '@lattice/view/types';
import { createCanvasAdapter, type CanvasAdapterOptions } from './adapter';
import { createCanvasAddEventListener } from './addEventListener';

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
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 * import { createDOMViewSvc } from '@lattice/view/presets/dom';
 * import { createCanvasViewSvc } from './canvas-adapter';
 *
 * const signals = createSignalsSvc();
 * const dom = createDOMViewSvc(signals);
 * const canvas = createCanvasViewSvc(signals, { clearColor: '#16213e' });
 *
 * export const { signal, computed } = signals;
 * export { dom, canvas };
 * ```
 */
export const createCanvasViewSvc = <
  TSignals extends {
    signal: <T>(initialValue: T) => Writable<T>;
    computed: <T>(fn: () => T) => Readable<T>;
    effect: (fn: () => void | (() => void)) => () => void;
    batch: <T>(fn: () => T) => T;
  },
>(
  signals: TSignals,
  options: CanvasAdapterOptions = {}
) => {
  const { adapter, hitTest } = createCanvasAdapter(options);
  const viewSvc = createViewSvc(adapter)();

  const svc = {
    ...viewSvc,
    on: createCanvasAddEventListener(hitTest, signals.batch),
  };

  return {
    ...svc,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

export type CanvasViewSvc = ReturnType<typeof createCanvasViewSvc>;
