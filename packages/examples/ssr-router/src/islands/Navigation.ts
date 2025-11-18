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
    const { el } = api;

    // Check if we're on the client and have Link component
    // Link is added to the API on the client only
    type LinkFunction = (props: { href: string; className: string }) => (...children: string[]) => RefSpec<HTMLAnchorElement>;
    const Link: LinkFunction | null = 'Link' in api ? (api as typeof api & { Link: LinkFunction }).Link : null;

    // Helper to create a nav link
    const navLink = (href: string, label: string) => {
      const isActive = props.currentPath === href;
      const className = isActive ? 'nav-link active' : 'nav-link';

      if (Link) {
        // CLIENT: Use Link component for SPA navigation
        return Link({ href, className })(label);
      } else {
        // SERVER: Render plain anchor tag
        return el('a', { href, className })(label);
      }
    };

    return el('div', { className: 'nav-links' })(
      navLink('/', 'Home'),
      navLink('/about', 'About'),
      navLink('/products', 'Products')
    )();
  })
);
