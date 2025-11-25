/**
 * Navigation Island
 *
 * Provides client-side navigation using Link components.
 * On the server, renders plain anchor tags.
 * On the client, intercepts clicks for SPA-style navigation.
 */
import { Link } from '@lattice/router/link';
import { island, router, type Service } from '../service.js';

interface NavigationProps {
  currentPath: string;
}

export const Navigation = island<NavigationProps, Service>(
  'Navigation',
  ({ el, computed }) =>
    ({ currentPath }) => {
      const currentPathSignal = router.useCurrentPath(currentPath);

      const navLink = (href: string, label: string) => {
        return Link({
          href,
          className: computed(() => {
            const path = currentPathSignal();
            const isActive = path === href;
            return isActive ? 'nav-link active' : 'nav-link';
          }),
        })(label);
      };

      return el('div', { className: 'nav-links' })(
        navLink('/', 'Home'),
        navLink('/about', 'About'),
        navLink('/products', 'Products')
      );
    }
);
