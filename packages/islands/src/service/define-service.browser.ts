/**
 * Service Definition - Browser Version
 *
 * Browser-safe version that doesn't import server-only dependencies.
 * The actual service creation happens in hydrateApp with the DOM renderer.
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';

// Re-export interface types from shared types file
export type { ServiceDescriptor } from './types';
import type { ServiceDescriptor } from './types';

/**
 * Helper function to get the type (never actually called in browser)
 */
function _createBaseServiceForType() {
  const signals = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);
  const views = composeFrom(defaultViewExtensions<DOMRendererConfig>(), viewHelpers);
  return { ...signals, ...views };
}

/**
 * Full base service type - inferred from actual implementation
 * This includes proper types for el, signal, computed, etc.
 */
export type FullBaseService = ReturnType<typeof _createBaseServiceForType>;

/**
 * Base service type alias for compatibility
 */
export type BaseService = FullBaseService;

/**
 * createBaseService is not available in browser
 * Service creation happens inside hydrateApp
 */
export function createBaseService(): FullBaseService {
  throw new Error('createBaseService should not be called in browser');
}

/**
 * Define a service with optional extensions
 *
 * Same as server version - just stores the extend function for later use.
 */
export function defineService<TService = FullBaseService>(
  extend?: (base: FullBaseService) => TService
): ServiceDescriptor<TService> {
  // Cast to accept unknown since server/client base services have compatible shapes
  const extendFn = (base: unknown) => {
    if (extend) {
      return extend(base as FullBaseService);
    }
    return base as unknown as TService;
  };

  return {
    extend: extendFn,
  };
}
