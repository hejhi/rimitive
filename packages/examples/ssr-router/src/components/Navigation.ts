/**
 * Navigation Component
 *
 * Provides client-side navigation using Link components.
 * Uses currentPath from the service for reactive URL tracking.
 */
import { Link } from '@lattice/router/link';
import type { Service } from '../service.js';

export const Navigation =
  ({ el, computed, currentPath }: Service) =>
  () => {
    const navLink = (href: string, label: string) => {
      return Link({
        href,
        className: computed(() => {
          const path = currentPath();
          const isActive = path === href;
          return isActive ? 'nav-link active' : 'nav-link';
        }),
      })(label);
    };

    return el('div').props({ className: 'nav-links' })(
      navLink('/', 'Home'),
      navLink('/about', 'About'),
      navLink('/products', 'Products'),
      navLink('/stats', 'Stats')
    );
  };
