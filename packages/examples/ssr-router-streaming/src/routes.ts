/**
 * Route Configuration
 *
 * Pure data - just route IDs and paths.
 * Components are mapped in the view layer.
 */
import type { RouteConfig } from '@rimitive/router';

export const routes: RouteConfig[] = [
  { id: 'overview', path: '' },
  { id: 'site-detail', path: 'sites/:id' },
  { id: 'feed', path: 'feed' },
];
