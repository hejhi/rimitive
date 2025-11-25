/**
 * Universal Route Definitions
 *
 * These routes work on both server and client.
 * The server renders them to HTML with islands.
 * The client hydrates islands and enables SPA navigation.
 */
import type { Router } from '@lattice/router';
import type { RefSpec } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { AppLayout } from './layouts/AppLayout.js';
import { Home } from './pages/Home.js';
import { About } from './pages/About.js';
import { Products } from './pages/Products.js';

/**
 * Create the full application (layout + routes) for SSR
 *
 * Uses router.root() to define the root layout - this returns an element directly
 * (not wrapped in show()) which is required for SSR where fragments need a parent element.
 */
export function createApp(router: Router<DOMRendererConfig>) {
  const { create, route } = router.root('/', AppLayout());

  return create(
    route('', Home())(),
    route('about', About())(),
    route('products', Products())()
  );
}

/**
 * Create just the route content for client-side mounting
 *
 * This allows mounting routes into an existing .main-content element
 * without replacing the entire app (preserving hydrated islands in the navbar).
 *
 * @param router - Router instance for route creation
 * @param svc - Full service (el is extracted from this)
 */
export function createRouteContent(
  router: Router<DOMRendererConfig>,
  svc: {
    el: (
      tag: 'div',
      props?: Record<string, unknown>
    ) => (
      ...children: RefSpec<DOMRendererConfig['baseElement']>[]
    ) => RefSpec<HTMLDivElement>;
  }
) {
  const { route } = router;
  const { el } = svc;

  // Routes with absolute paths for standalone mounting
  // Wrapped in a div since fragments need a parent element
  return el('div', { className: 'route-content' })(
    route('/', Home())().unwrap(),
    route('/about', About())().unwrap(),
    route('/products', Products())().unwrap()
  );
}
