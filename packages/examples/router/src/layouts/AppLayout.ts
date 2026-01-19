/**
 * App Layout
 *
 * Renders navbar and route content based on router.matches().
 */
import type { RefSpec } from '@rimitive/view/types';
import type { MatchedRoute } from '@rimitive/router';
import { Link } from '@rimitive/router/link';
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
  'product-detail': ProductDetail,
};

export const AppLayout = (svc: Service) => {
  const { el, match, router, computed } = svc;
  const { matches, currentPath } = router;

  return el('div').props({ className: 'app-layout' })(
    // Navbar with navigation
    el('nav').props({ className: 'navbar' })(
      el('div').props({ className: 'nav-brand' })(el('h1')('Rimitive Router')),
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
        if (!route) return svc(NotFound)();

        const Component = componentMap[route.id];
        if (!Component) return svc(NotFound)();

        return svc(Component)({ params: route.params });
      })
    )
  );
};
