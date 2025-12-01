/**
 * Canvas Example - Service Composition
 *
 * Demonstrates how to compose custom adapters with the view system.
 * This example shows mixing DOM and Canvas rendering in a single tree,
 * both sharing the same signals service for reactive state.
 *
 * The canvas adapter is a reference implementation showing how to build
 * custom NodeAdapters for non-DOM targets.
 */
import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  createCanvasAdapter,
  createCanvasAddEventListener,
  type CanvasAdapterConfig,
} from './canvas-adapter';
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
// DOM Adapter (for toolbar/UI)
// ============================================================================

const domAdapter = createDOMRenderer();
const domViewHelpers = defaultViewHelpers(domAdapter, signalsSvc);
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
// Canvas Adapter (for scene)
// ============================================================================

const canvasAdapter = createCanvasAdapter({
  clearColor: '#16213e',
});

const canvasViewHelpers = defaultViewHelpers<CanvasAdapterConfig>(
  canvasAdapter as Renderer<CanvasAdapterConfig>,
  signalsSvc
);
const { el: canvasEl, ...canvasViewSvc } = composeFrom(
  defaultViewExtensions<CanvasAdapterConfig>(),
  canvasViewHelpers
);

export const canvas = {
  ...canvasViewSvc,
  cvs: canvasEl,
  adapter: canvasAdapter,
  on: createCanvasAddEventListener(canvasAdapter, signalsSvc.batch),
  mount: <TElement>(spec: RefSpec<TElement>) => spec.create(canvasViewSvc),
};

// ============================================================================
// Shared Signals Exports
// ============================================================================

export const { signal, computed, effect, batch, subscribe } = signalsSvc;

// Re-export types from canvas adapter
export type {
  CanvasNode,
  CanvasPointerEvent,
  CanvasBridgeElement,
} from './canvas-adapter';
