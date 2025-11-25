/**
 * Service Definition
 *
 * Functional approach to defining services with type inference.
 * The extend closure is stored and called later at instantiation time.
 */

import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '../renderers/dom-server';

// Re-export interface types from shared types file
export type { ServiceDescriptor } from './types';
import type { ServiceDescriptor } from './types';

// Helper to avoid circular reference
const defaultExtensions = defaultViewExtensions;

/**
 * Create the base service with server renderer
 * Called per-request on server
 *
 * Note: Return type is inferred (not annotated) so FullBaseService can capture it
 */
export function createBaseService() {
  const signals = createSignalsApi();
  const renderer = createDOMServerRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);
  const views = composeFrom(
    defaultExtensions<DOMServerRendererConfig>(),
    viewHelpers
  );

  return {
    ...signals,
    ...views,
  };
}

/**
 * Full base service type - inferred from actual implementation
 * This includes proper types for el, signal, computed, etc.
 */
export type FullBaseService = ReturnType<typeof createBaseService>;

/**
 * Base service type alias for compatibility
 */
export type BaseService = FullBaseService;

/**
 * Define a service with optional extensions
 *
 * Returns the extend closure with type inference. The closure is called
 * later at instantiation time by createSSRHandler or hydrateApp.
 */
export function defineService<TService = FullBaseService>(
  extend?: (base: FullBaseService) => TService
): ServiceDescriptor<TService> {
  // Default extend function just returns base as-is
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
