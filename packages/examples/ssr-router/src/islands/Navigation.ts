/**
 * Navigation Island
 *
 * Provides client-side navigation using Link components.
 * On the server, renders plain anchor tags.
 * On the client, intercepts clicks for SPA-style navigation.
 */
import { island } from '@lattice/islands/island';
import { create } from '../api.js';
import type { RefSpec } from '@lattice/view/types';

interface NavigationProps {
  currentPath: string;
}

export const Navigation = island(
  'Navigation',
  create((api) => (props: NavigationProps) => {
    const { el, computed } = api;

    // Check if we're on the client and have Link component and currentPath signal
    // These are added to the API on the client only
    type ComputedValue<T> = { (): T; peek(): T };
    type LinkFunction = (props: {
      href: string;
      className: string | ComputedValue<string>;
    }) => (...children: string[]) => RefSpec<HTMLAnchorElement>;
    type CurrentPathSignal = {
      (): string;
      (value: string): void;
      peek(): string;
    };

    const Link: LinkFunction | null =
      'Link' in api ? (api as typeof api & { Link: LinkFunction }).Link : null;
    const currentPathSignal: CurrentPathSignal | null =
      'currentPath' in api
        ? (api as typeof api & { currentPath: CurrentPathSignal }).currentPath
        : null;

    // Helper to create a nav link
    const navLink = (href: string, label: string) => {
      if (Link) {
        // CLIENT: Use Link component for SPA navigation
        if (currentPathSignal) {
          // With reactive className using computed
          return Link({
            href,
            className: computed(() => {
              const path = currentPathSignal();
              const isActive = path === href;
              return isActive ? 'nav-link active' : 'nav-link';
            }),
          })(label);
        }

        // Without reactive className (fallback during hydration)
        const path = props.currentPath;
        const isActive = path === href;
        const className = isActive ? 'nav-link active' : 'nav-link';
        return Link({ href, className })(label);
      }

      // SERVER: Render plain anchor tag with static className
      const path = props.currentPath;
      const isActive = path === href;
      const className = isActive ? 'nav-link active' : 'nav-link';
      return el('a', { href, className })(label);
    };

    return el('div', { className: 'nav-links' })(
      navLink('/', 'Home'),
      navLink('/about', 'About'),
      navLink('/products', 'Products')
    )();
  })
);
