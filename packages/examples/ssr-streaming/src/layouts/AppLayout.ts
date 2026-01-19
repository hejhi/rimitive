/**
 * App Layout
 *
 * Renders navbar and route content based on router.matches().
 */
import type { RefSpec } from '@rimitive/view/types';
import type { MatchedRoute } from '@rimitive/router';
import type { Service } from '../service.js';
import { Navigation } from '../components/Navigation.js';
import { Home } from '../pages/Home.js';
import { About } from '../pages/About.js';
import { Products } from '../pages/Products.js';
import { ProductDetail } from '../pages/ProductDetail.js';
import { Stats } from '../pages/Stats.js';
import { NotFound } from '../pages/NotFound.js';

/**
 * Map route IDs to portable component functions
 *
 * All pages follow the portable style: (svc) => () => RefSpec
 * We wrap them to fit the (svc) => (props) => RefSpec signature.
 */
const componentMap: Record<
  string,
  (
    svc: Service
  ) => (props: { params: Record<string, string> }) => RefSpec<unknown>
> = {
  home: Home,
  about: About,
  products: Products,
  'product-detail': ProductDetail,
  // Stats uses load() internally for async data - same pattern as other routes
  stats: Stats,
};

export const AppLayout = (svc: Service) => {
  const { el, match, router } = svc;

  return el('div').props({ className: 'app' })(
    // Navbar with navigation
    el('nav').props({ className: 'navbar' })(
      el('div').props({ className: 'nav-brand' })(
        el('h1')('🧩 Rimitive SSR + Router')
      ),
      svc(Navigation)()
    ),

    // Route content - renders based on router.matches()
    el('main').props({ className: 'main-content' })(
      match(router.matches, (matchedRoutes: MatchedRoute[]) => {
        const route = matchedRoutes[0];
        if (!route) return svc(NotFound)();

        const Component = componentMap[route.id];
        if (!Component) return svc(NotFound)();

        return svc(Component)({ params: route.params });
      })
    )
  );
};
