/**
 * App Layout
 *
 * Renders navbar and route content based on router.matches().
 */
import type { RefSpec } from '@lattice/view/types';
import type { MatchedRoute } from '@lattice/router';
import type { Service } from '../service.js';
import { Navigation } from '../islands/Navigation.js';
import { Home } from '../pages/Home.js';
import { About } from '../pages/About.js';
import { Products } from '../pages/Products.js';
import { ProductDetail } from '../pages/ProductDetail.js';

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
  home: (svc) => () => Home(svc)(),
  about: (svc) => () => About(svc)(),
  products: (svc) => () => Products(svc)(),
  'product-detail':
    (svc) =>
    ({ params }) =>
      ProductDetail(svc, { params: params as { id: string } }),
};

const NotFound = (svc: Service) => () => {
  const { el, navigate } = svc;
  return el('div').props({ className: 'page not-found' })(
    el('h2')('Page Not Found'),
    el('p')('The page you are looking for does not exist.'),
    el('button').props({
      className: 'primary-btn',
      onclick: () => navigate('/'),
    })('← Go Home')
  );
};

export const AppLayout = (svc: Service) => () => {
  const { el, match, matches, use } = svc;

  return el('div').props({ className: 'app' })(
    // Navbar with navigation island
    el('nav').props({ className: 'navbar' })(
      el('div').props({ className: 'nav-brand' })(
        el('h1')('🧩 Lattice SSR + Router')
      ),
      Navigation({})
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
};
