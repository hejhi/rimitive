/**
 * Route Configuration
 *
 * Shared between worker and main thread.
 * Pure data - just route IDs and paths.
 */
import type { RouteConfig } from '@rimitive/router';

export const routes: RouteConfig[] = [
  { id: 'home', path: '' },
  { id: 'detail', path: 'list/:id' },
];
