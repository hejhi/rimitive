/**
 * Canvas Example - Service Composition
 *
 * Demonstrates how to compose custom adapters with the view system.
 * This example shows mixing DOM and Canvas rendering in a single tree,
 * both sharing the same signals service for reactive state.
 */
import { createSignals } from '@lattice/signals/presets/core';
import { createDOMView } from '@lattice/view/presets/dom';
import { createCanvasViewSvc } from './canvas-adapter';

// Shared signals service
const signals = createSignals();

// DOM view (for toolbar/UI)
const domSvc = createDOMView({ signals })();

// Canvas view (for scene)
const canvasSvc = createCanvasViewSvc({ signals }, { clearColor: '#16213e' });

// Export signals
export const { signal, computed, effect, batch, subscribe } = signals();

// Export canvas types
export type {
  CanvasNode,
  CanvasPointerEvent,
  CanvasBridgeElement,
} from './canvas-adapter';

// Pre-bound element factories for ergonomic usage
export const dom = {
  div: domSvc.el('div'),
  h1: domSvc.el('h1'),
  p: domSvc.el('p'),
  strong: domSvc.el('strong'),
  code: domSvc.el('code'),
  button: domSvc.el('button'),
  ...domSvc,
};

export const canvas = {
  canvas: canvasSvc.el('canvas'),
  rect: canvasSvc.el('rect'),
  circle: canvasSvc.el('circle'),
  group: canvasSvc.el('group'),
  ...canvasSvc,
};
