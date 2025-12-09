/**
 * SSR Service - Browser-Safe Island Factory
 *
 * This file creates a typed island factory for use in island definitions.
 * It uses the browser-safe export path that doesn't include Node.js dependencies.
 *
 * Islands import from this file, which gets bundled for the browser.
 * Server-side code should import from service.server.ts instead.
 */

import { createIsland } from '@lattice/islands';
import type { SignalFactory, ComputedFactory, EffectFactory } from '@lattice/signals/presets/core';
import type { ElFactory, MapFactory, MatchFactory } from '@lattice/view/presets/core';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

// Define the Service type inline to avoid circular dependency with service.server.ts
// This matches the composed service type from service.server.ts
export type Service = {
  signal: SignalFactory;
  computed: ComputedFactory;
  effect: EffectFactory;
  batch: (fn: () => void) => void;
  el: ElFactory<DOMAdapterConfig>;
  map: MapFactory<DOMAdapterConfig['baseElement']>;
  match: MatchFactory<DOMAdapterConfig['baseElement']>;
  mount: <T>(spec: { create: (svc: Service) => T }) => T;
};

// Create typed island factory - uses browser condition in @lattice/islands
// In browser: loads island.browser.ts (no AsyncLocalStorage)
// In Node: loads island.ts (with SSR context)
export const island = createIsland<Service>();
