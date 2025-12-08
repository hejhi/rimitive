/**
 * Link component for declarative navigation
 *
 * Regular component (not an extension) that can be imported and used directly.
 * Automatically gets navigate from API if available (client-side).
 */

import type { ElRefSpecChild, RefSpec, LifecycleCallback } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { ElementProps, ElFactory } from '@lattice/view/el';
import { getActiveRouterContext } from './ssr-context';

/**
 * Link builder function
 *
 * Link is inherently DOM-coupled (uses window.history, MouseEvent, href, onclick).
 * Routers are web browser concepts - no need for adapter abstraction here.
 *
 * @example
 * ```typescript
 * import { Link } from '@lattice/router';
 *
 * // Basic link
 * const navLink = Link({ href: '/about' })('About Us');
 *
 * // Link with props
 * const styledLink = Link({
 *   href: '/products',
 *   class: 'nav-link',
 *   onclick: (e) => console.log('clicked')
 * })('Products');
 *
 * // Dynamic navigation
 * const productId = signal('123');
 * const dynamicLink = Link({
 *   href: computed(() => `/products/${productId()}`)
 * })('View Product');
 * ```
 */
export function Link(
  props: ElementProps<DOMAdapterConfig, 'a'> & { href: string }
): (...children: ElRefSpecChild[]) => RefSpec<HTMLAnchorElement> {
  return (...children: ElRefSpecChild[]): RefSpec<HTMLAnchorElement> => {
    const lifecycleCallbacks: LifecycleCallback<HTMLAnchorElement>[] = [];

    const refSpec: RefSpec<HTMLAnchorElement> = (
      ...callbacks: LifecycleCallback<HTMLAnchorElement>[]
    ) => {
      lifecycleCallbacks.push(...callbacks);
      return refSpec;
    };

    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = (svc: { el: ElFactory<DOMAdapterConfig> }) => {
      const { el } = svc;
      const { href, onclick: userOnClick, ...restProps } = props;

      // Get navigate from API if available
      const navigate: ((path: string) => void) | null =
        'navigate' in svc
          ? (svc as { navigate: (path: string) => void }).navigate
          : null;

      const ssrContext = getActiveRouterContext();
      if (ssrContext) {
        // SERVER: Plain anchor, no click interception
        const anchorSpec = el('a').props({
          ...restProps,
          href,
          onclick: userOnClick,
        })(...children);
        return anchorSpec.create(svc);
      }

      // CLIENT: Check if we have navigate function
      if (!navigate) {
        // No navigate function available, render plain anchor
        const anchorSpec = el('a').props({
          ...restProps,
          href,
          onclick: userOnClick,
        })(...children);
        return anchorSpec.create(svc);
      }

      // CLIENT: Add navigation handler

      // Helper to check if link is external
      const isExternal = (url: string): boolean => {
        return (
          url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('//')
        );
      };

      // Navigation click handler
      const handleClick = (event: MouseEvent): void => {
        // Call user's onclick if provided (handle both static and reactive)
        if (userOnClick) {
          const onClick =
            typeof userOnClick === 'function' && userOnClick.length === 0
              ? (userOnClick as () => (e: MouseEvent) => unknown)()
              : (userOnClick as (e: MouseEvent) => unknown);

          if (onClick) onClick(event);
        }

        // Don't intercept if:
        // - Modifier keys are pressed (allow opening in new tab)
        // - Not a left-click (button !== 0)
        // - Link is external
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0 ||
          isExternal(href)
        ) {
          return;
        }

        // Intercept and navigate
        event.preventDefault();
        event.stopPropagation();
        navigate(href);
      };

      // Create anchor element with onclick handler merged with user's onclick
      const anchorSpec = el('a').props({
        ...restProps,
        href,
        onclick: handleClick,
      })(...children);

      return anchorSpec.create(svc);
    };

    return refSpec;
  };
}
