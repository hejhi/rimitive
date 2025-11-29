/**
 * Shared API for islands
 *
 * This provides the type-safe API that island components use.
 * On the server, we use SSR renderer. On the client, DOM renderer.
 */
import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions, defaultHelpers } from '@lattice/view/presets/core';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import { createIsland } from '@lattice/islands/factory';
import type { RefSpec } from '@lattice/view/types';
import type { ElFactory } from '@lattice/view/el';
import type { MapFactory } from '@lattice/view/map';
import type { MatchFactory } from '@lattice/view/match';
import type {
  SignalFunction,
  ComputedFunction,
} from '@lattice/signals/presets/core';

/**
 * Service type - the API available to island components
 */
export type Service = {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: <T>(fn: () => T) => T;
  el: ElFactory<DOMRendererConfig>['impl'];
  map: MapFactory<DOMRendererConfig['baseElement']>['impl'];
  match: MatchFactory<DOMRendererConfig['baseElement']>['impl'];
};

/**
 * Typed island factory - no generics needed at call site!
 */
export const island = createIsland<Service>();

// Create view API (for client-side)
const createViewApi = () => {
  const signalSvc = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultHelpers(renderer, signalSvc);
  const viewSvc = composeFrom(
    defaultExtensions<DOMRendererConfig>(),
    viewHelpers
  );

  const svc = {
    ...signalSvc,
    ...viewSvc,
  };

  return {
    service: {
      view: viewSvc,
      signals: signalSvc,
    },
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
};

export const { service, mount } = createViewApi();

export type Signals = typeof service.signals;
export type DOMViews = typeof service.view;
