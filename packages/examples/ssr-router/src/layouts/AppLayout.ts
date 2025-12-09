/**
 * App Layout
 *
 * Renders navbar and route content based on router.matches().
 */
import type { RefSpec } from '@lattice/view/types';
import type { MatchedRoute } from '@lattice/router';
import type { Service } from '../service.js';
import { Navigation } from '../components/Navigation.js';
import { Home } from '../pages/Home.js';
import { About } from '../pages/About.js';
import { Products } from '../pages/Products.js';
import { ProductDetail } from '../pages/ProductDetail.js';
import { NotFound } from '../pages/NotFound.js';

/**
 * Map route IDs to portable component functions
 *
 * Since pages are in portable style: (svc) => () => RefSpec,
 * we wrap them to fit the (svc) => (props) => RefSpec signature.
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
  'product-detail':
    (svc) =>
    ({ params }) =>
      ProductDetail(svc, { params: params as { id: string } }),
};

export const AppLayout = ({ el, match, matches, use }: Service) =>
  el('div').props({ className: 'app' })(
    // Navbar with navigation
    el('nav').props({ className: 'navbar' })(
      el('div').props({ className: 'nav-brand' })(
        el('h1')('🧩 Lattice SSR + Router')
      ),
      use(Navigation)({})
    ),

    // Route content - renders based on router.matches()
    el('main').props({ className: 'main-content' })(
      match(matches, (matchedRoutes: MatchedRoute[]) => {
        const route = matchedRoutes[0];
        if (!route) return use(NotFound)({});

        const Component = componentMap[route.id];
        if (!Component) return use(NotFound)({});

        return use(Component)({ params: route.params });
      })
    )
  );
