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

import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { MountModule } from '@rimitive/view/deps/mount';
import type { RefSpec } from '@rimitive/view/types';
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
 * @example
 * ```ts
 * import { createCanvasViewSvc } from './canvas-adapter';
 *
 * const canvas = createCanvasViewSvc({ clearColor: '#16213e' });
 *
 * export const { signal, computed, el, map, match } = canvas;
 * ```
 */
export const createCanvasViewSvc = (options: CanvasAdapterOptions) => {
  const { adapter, hitTest } = createCanvasAdapter(options);

  // Create canvas-adapter-bound view modules
  const CanvasElModule = createElModule(adapter);
  const CanvasMapModule = createMapModule(adapter);
  const CanvasMatchModule = createMatchModule(adapter);

  // Compose canvas view service
  const viewSvc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    CanvasElModule,
    CanvasMapModule,
    CanvasMatchModule,
    MountModule
  );

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
