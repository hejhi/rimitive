/**
 * App-level API for Canvas example
 *
 * Demonstrates mixing renderers: DOM for UI controls, Canvas for the scene.
 * Both share the same signals service for reactive state.
 */
import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  createCanvasRenderer,
  createCanvasAddEventListener,
  type CanvasRendererConfig,
} from '@lattice/canvas';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import type { RefSpec, Renderer } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

// ============================================================================
// Shared Signals Service
// ============================================================================

const signalsSvc = createSignalsApi();

// ============================================================================
// DOM Renderer (for toolbar/UI)
// ============================================================================

const domRenderer = createDOMRenderer();
const domViewHelpers = defaultViewHelpers(domRenderer, signalsSvc);
const domViewSvc = composeFrom(
  defaultViewExtensions<DOMRendererConfig>(),
  domViewHelpers
);

export const dom = {
  ...domViewSvc,
  addEventListener: createAddEventListener(domViewHelpers.batch),
  mount: <TElement>(spec: RefSpec<TElement>) => spec.create(domViewSvc),
};

// ============================================================================
// Canvas Renderer (for scene)
// ============================================================================

const canvasRenderer = createCanvasRenderer({
  clearColor: '#16213e',
});

const canvasViewHelpers = defaultViewHelpers<CanvasRendererConfig>(
  canvasRenderer as Renderer<CanvasRendererConfig>,
  signalsSvc
);
const { el: canvasEl, ...canvasViewSvc } = composeFrom(
  defaultViewExtensions<CanvasRendererConfig>(),
  canvasViewHelpers
);

export const canvas = {
  ...canvasViewSvc,
  cvs: canvasEl,
  renderer: canvasRenderer,
  on: createCanvasAddEventListener(canvasRenderer, signalsSvc.batch),
  mount: <TElement>(spec: RefSpec<TElement>) => spec.create(canvasViewSvc),
};

// ============================================================================
// Shared Signals Exports
// ============================================================================

export const { signal, computed, effect, batch, subscribe } = signalsSvc;

// Re-export types
export type {
  CanvasNode,
  CanvasPointerEvent,
  CanvasBridgeElement,
} from '@lattice/canvas';
