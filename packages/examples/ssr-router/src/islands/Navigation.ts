/**
 * Navigation Island
 *
 * Provides client-side navigation using Link components.
 * On the server, renders plain anchor tags.
 * On the client, intercepts clicks for SPA-style navigation.
 *
 * Uses currentPath from the service for reactive URL tracking.
 */
import { Link } from '@lattice/router/link';
import { island } from '../service.js';

export const Navigation = island('Navigation', ({ el, computed, currentPath }) => () => {
  const navLink = (href: string, label: string) => {
    return Link({
      href,
      className: computed(() => {
        // currentPath works on both server and client
        const path = currentPath();
        const isActive = path === href;
        return isActive ? 'nav-link active' : 'nav-link';
      }),
    })(label);
  };

  return el('div').props({ className: 'nav-links' })(
    navLink('/', 'Home'),
    navLink('/about', 'About'),
    navLink('/products', 'Products')
  );
});
