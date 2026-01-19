/**
 * Route Configuration
 *
 * Pure data - just route IDs and paths.
 * Components are mapped in the view layer.
 */
import type { RouteConfig } from '@rimitive/router';

export const routes: RouteConfig[] = [
  { id: 'home', path: '' },
  { id: 'about', path: 'about' },
  { id: 'products', path: 'products' },
  { id: 'product-detail', path: 'products/:id' },
  { id: 'stats', path: 'stats' },
];
