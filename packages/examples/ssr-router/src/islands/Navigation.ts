/**
 * Navigation Island
 *
 * Provides client-side navigation using Link components.
 * On the server, renders plain anchor tags.
 * On the client, intercepts clicks for SPA-style navigation.
 */
import { Link } from '@lattice/router/link';
import { island } from '../service.js';

export const Navigation = island(
  'Navigation',
  ({ el, computed }, getContext) =>
    () => {
      const navLink = (href: string, label: string) => {
        return Link({
          href,
          className: computed(() => {
            const ctx = getContext();
            const path = ctx?.pathname ?? '/';
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
