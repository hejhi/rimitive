/**
 * App Layout
 *
 * Renders navbar and route content based on router.matches().
 */
import type { RefSpec } from '@lattice/view/types';
import type { MatchedRoute } from '@lattice/router';
import { Link } from '@lattice/router/link';
import type { Service } from '../service';
import { Home } from '../pages/Home';
import { About } from '../pages/About';
import { Products } from '../pages/Products';
import { ProductDetail } from '../pages/ProductDetail';
import { NotFound } from '../pages/NotFound';

/**
 * Map route IDs to portable component functions
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

export const AppLayout = ({ el, match, matches, computed, currentPath, use }: Service) =>
  el('div').props({ className: 'app-layout' })(
    // Navbar with navigation
    el('nav').props({ className: 'navbar' })(
      el('div').props({ className: 'nav-brand' })(
        el('h1')('Lattice Router')
      ),
      el('div').props({ className: 'nav-links' })(
        Link({
          href: '/',
          className: computed(() =>
            currentPath() === '/' ? 'nav-link active' : 'nav-link'
          ),
        })('Home'),
        Link({
          href: '/about',
          className: computed(() =>
            currentPath() === '/about' ? 'nav-link active' : 'nav-link'
          ),
        })('About'),
        Link({
          href: '/products',
          className: computed(() =>
            currentPath().startsWith('/products')
              ? 'nav-link active'
              : 'nav-link'
          ),
        })('Products')
      )
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
