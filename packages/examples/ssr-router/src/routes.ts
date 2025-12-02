/**
 * Universal Route Definitions
 *
 * These routes work on both server and client.
 * Routes are defined as pure data using defineRoutes(),
 * then bound to a router via router.mount().
 */
import { defineRoutes } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { AppLayout } from './layouts/AppLayout.js';
import { Home } from './pages/Home.js';
import { About } from './pages/About.js';
import { Products } from './pages/Products.js';
import { ProductDetail } from './pages/ProductDetail.js';

/**
 * Route tree definition - pure data, no router instance needed
 *
 * This enables:
 * - Same route definition works on server and client
 * - No singleton router at module load time
 * - Clean SSR without proxy patterns
 */
const { create, route } = defineRoutes<DOMAdapterConfig>('/', AppLayout());

export const appRoutes = create(
  route('', Home())(),
  route('about', About())(),
  route('products', Products())(),
  route('products/:id', ProductDetail())()
);
