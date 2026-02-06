/**
 * Share Card Demo - Service Composition
 *
 * Composes DOM and Canvas adapters with SHARED signals.
 * Both renderers react to the same state changes by sharing
 * the same scopes (which contain the reactive effect system).
 */
import { compose, merge } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  IterModule,
  UntrackModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { ElModule, createElFactory } from '@rimitive/view/el';
import { MapModule, createMapFactory } from '@rimitive/view/map';
import { MatchModule, createMatchFactory } from '@rimitive/view/match';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { MountModule } from '@rimitive/view/deps/mount';
import { ScopesModule } from '@rimitive/view/deps/scope';
import { createCanvasAdapter } from './canvas-adapter/adapter';
import { createCanvasAddEventListener } from './canvas-adapter/addEventListener';
import type { CanvasTreeConfig } from './canvas-adapter/types';
import { domCardElements, canvasCardElements } from './card-elements';

// Create adapters
const domAdapter = createDOMAdapter();
const { adapter: canvasAdapter, hitTest } = createCanvasAdapter({ clearColor: '#0f0f23' });

// Compose DOM service with all signal modules
const domSvc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  IterModule,
  UntrackModule,
  ScopesModule, // Explicitly include so we can access it
  ElModule.with({ adapter: domAdapter }),
  MapModule.with({ adapter: domAdapter }),
  MatchModule.with({ adapter: domAdapter }),
  OnModule,
  MountModule
);

// Create canvas view factories using the SAME scopes as DOM
// This shares the reactive system between both renderers
const canvasEl = createElFactory<CanvasTreeConfig>({
  adapter: canvasAdapter,
  scopedEffect: domSvc.scopes.scopedEffect,
  createElementScope: domSvc.scopes.createElementScope,
  onCleanup: domSvc.scopes.onCleanup,
});

const canvasMap = createMapFactory<CanvasTreeConfig>({
  adapter: canvasAdapter,
  scopedEffect: domSvc.scopes.scopedEffect,
  getElementScope: domSvc.scopes.getElementScope,
  disposeScope: domSvc.scopes.disposeScope,
  withScope: domSvc.scopes.withScope,
  createChildScope: domSvc.scopes.createChildScope,
  signal: domSvc.signal,
  computed: domSvc.computed,
  iter: domSvc.iter,
  untrack: domSvc.untrack,
});

const canvasMatch = createMatchFactory<CanvasTreeConfig>({
  adapter: canvasAdapter,
  scopedEffect: domSvc.scopes.scopedEffect,
  getElementScope: domSvc.scopes.getElementScope,
  disposeScope: domSvc.scopes.disposeScope,
  withScope: domSvc.scopes.withScope,
  createChildScope: domSvc.scopes.createChildScope,
});

// Export shared signals
export const { signal, computed, effect, batch } = domSvc;

// Export canvas types
export type {
  CanvasNode,
  CanvasPointerEvent,
  CanvasBridgeElement,
} from './canvas-adapter';

// Pre-bound element factories
export const dom = {
  ...domSvc,
  div: domSvc.el('div'),
  h1: domSvc.el('h1'),
  p: domSvc.el('p'),
  span: domSvc.el('span'),
  a: domSvc.el('a'),
  label: domSvc.el('label'),
  input: domSvc.el('input'),
  button: domSvc.el('button'),
  code: domSvc.el('code'),
  strong: domSvc.el('strong'),
  br: domSvc.el('br'),
};

// Canvas service using shared reactive system
export const canvas = {
  el: canvasEl,
  map: canvasMap,
  match: canvasMatch,
  on: createCanvasAddEventListener(hitTest, domSvc.batch),
  canvas: canvasEl('canvas'),
  rect: canvasEl('rect'),
  circle: canvasEl('circle'),
  text: canvasEl('text'),
  image: canvasEl('image'),
  group: canvasEl('group'),
};

// Create services with card elements for portable components
// These can be used with svc(behavior) pattern
export const domCardSvc = merge(domSvc, { cardElements: domCardElements });
export const canvasCardSvc = merge(domSvc, {
  cardElements: canvasCardElements,
  el: canvasEl,
});

// Export types for portable components
export type DOM = typeof dom;
export type Canvas = typeof canvas;
