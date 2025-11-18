/**
 * Link component for declarative navigation
 */

import { create } from '@lattice/lattice';
import type { RefSpec, ElRefSpecChild } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { ElementProps } from '@lattice/view/el';
import type { LinkOpts, LinkFactory } from './types';

/**
 * Create Link factory that renders anchor elements with SPA navigation
 *
 * Link is inherently DOM-coupled (uses window.history, MouseEvent, href, onclick).
 * Routers are web browser concepts - no need for renderer abstraction here.
 */
export const createLinkFactory = create(
  ({
    el,
    navigate,
  }: LinkOpts) =>
    () => {
      function Link(
        props: ElementProps<DOMRendererConfig, 'a'> & { href: string }
      ): (...children: ElRefSpecChild[]) => RefSpec<HTMLAnchorElement> {
        return (...children: ElRefSpecChild[]) => {
          const { href, onclick: userOnClick, ...restProps } = props;

          // Helper to check if link is external
          const isExternal = (url: string): boolean => {
            return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
          };

          // Navigation click handler
          const handleClick = (event: MouseEvent): void => {
            // Call user's onclick if provided (handle both static and reactive)
            if (userOnClick) {
              const onClick = typeof userOnClick === 'function' && userOnClick.length === 0
                ? (userOnClick as () => ((e: MouseEvent) => unknown))()
                : userOnClick as (e: MouseEvent) => unknown;

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
          return el('a', {
            ...restProps,
            href,
            onclick: handleClick,
          })(...children);
        };
      }

      const extension: LinkFactory = {
        name: 'Link' as const,
        method: Link,
      };

      return extension;
    }
);
