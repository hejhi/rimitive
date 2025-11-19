/**
 * Navigation Island
 *
 * Provides client-side navigation using Link components.
 * On the server, renders plain anchor tags.
 * On the client, intercepts clicks for SPA-style navigation.
 */
import { island } from '@lattice/islands/island';
import { Link } from '@lattice/router/link';
import { create } from '../api.js';

interface NavigationProps {
  currentPath: string;
}

export const Navigation = island(
  'Navigation',
  create((api) => (props: NavigationProps) => {
    const { el, computed } = api;

    // Check if we're on the client and have currentPath signal
    // This is added to the API on the client only
    type CurrentPathSignal = {
      (): string;
      (value: string): void;
      peek(): string;
    };

    const currentPathSignal: CurrentPathSignal | null =
      'currentPath' in api
        ? (api as typeof api & { currentPath: CurrentPathSignal }).currentPath
        : null;

    // Helper to create a nav link
    const navLink = (href: string, label: string) => {
      if (currentPathSignal) {
        return Link({
          href,
          className: computed(() => {
            const path = currentPathSignal();
            const isActive = path === href;
            return isActive ? 'nav-link active' : 'nav-link';
          }),
        })(label);
      }

      // SERVER: Use Link component with static className
      // Link will render as plain anchor on server
      const path = props.currentPath;
      const isActive = path === href;
      const className = isActive ? 'nav-link active' : 'nav-link';
      return Link({ href, className })(label);
    };

    return el('div', { className: 'nav-links' })(
      // Remember, these are in the component closure, so they only run once!
      navLink('/', 'Home'),
      navLink('/about', 'About'),
      navLink('/products', 'Products')
    )();
  })
);
