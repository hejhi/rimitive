/**
 * Navigation Island
 *
 * Provides client-side navigation using Link components.
 * On the server, renders plain anchor tags.
 * On the client, intercepts clicks for SPA-style navigation.
 */
import { island } from '@lattice/islands/island';
import { Link } from '@lattice/router/link';
import { use, router } from '../api.js';

interface NavigationProps {
  currentPath: string;
}

export const Navigation = island(
  'Navigation',
  use((api) => (props: NavigationProps) => {
    const { el, computed } = api;
    const currentPathSignal = router.useCurrentPath(props.currentPath);

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
  })
);
