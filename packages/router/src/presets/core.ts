/**
 * Core router preset - universal routing extensions
 *
 * Provides route and location factories that work on both client and server.
 * Environment-specific concerns (currentPath, navigate, history) are handled
 * by browser and server presets.
 */

import { createRouteFactory } from '../route';
import { createLocationFactory } from '../location';
import type { RendererConfig } from '@lattice/view/types';

export type { RouteFactory } from '../types';
export type { LocationFactory } from '../types';

/**
 * Default router extensions
 * Returns factory functions for route and location
 */
export const defaultExtensions = <TConfig extends RendererConfig>() => ({
  route: createRouteFactory<TConfig>(),
  location: createLocationFactory(),
});
